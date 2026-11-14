// What the system tests of this adapter share: the test store, the testkit's OpenBao with a mount of the scenario, its
// write and read tokens with the policies that "policy write" and "policy read" print, and the adapter's CLI with the
// store's address and mount. Each helper only calls the adapter's CLI through sut, or the testkit's fakes.
import type { CliResult, OpenBao, ScenarioContext } from "@opensoftware/testkit";

type Sut = ScenarioContext["sut"];
type Fakes = ScenarioContext["fakes"];

/** A value no real system knows. */
export const VALUE = "lin_test_51c2";

export interface Store {
  bao: OpenBao;
  /** The store's address and the scenario's mount. */
  env: Record<string, string>;
  /** A token with the policy that "policy <which>" prints for the scenario's mount, that lives `ttl` (default 1h). */
  token(which: "write" | "read", ttl?: string): Promise<string>;
  /** Runs the adapter with the token; `stdin` goes to its standard input, `env` adds or replaces variables. */
  run(token: string, args: string[], options?: { stdin?: string; env?: Record<string, string> }): Promise<CliResult>;
  /** Runs the adapter with the token, expects exit code 0, and gives the JSON of each line. */
  lines(token: string, args: string[], stdin?: string): Promise<Record<string, unknown>[]>;
}

/** The test store: OpenBao with an empty mount for the scenario. */
export async function store(sut: Sut, fakes: Fakes): Promise<Store> {
  const bao = await fakes.openbao();
  const env = { OSF_OPENBAO_ADDR: bao.url, OSF_OPENBAO_MOUNT: bao.mount };
  const run: Store["run"] = (token, args, options = {}) =>
    sut.cli(args, { env: { ...env, OSF_OPENBAO_TOKEN: token, ...options.env }, stdin: options.stdin });
  return {
    bao,
    env,
    async token(which, ttl) {
      const policy = await sut.cli(["policy", which], { env });
      if (policy.exitCode !== 0) throw new Error(`policy ${which} exited with ${policy.exitCode}: ${policy.stderr}`);
      return bao.token(policy.stdout, ttl ? { ttl } : {});
    },
    run,
    async lines(token, args, stdin) {
      const result = await run(token, args, { stdin });
      if (result.exitCode !== 0) throw new Error(`${args[0]} exited with ${result.exitCode}: ${result.stderr}`);
      return result.stdout
        .split("\n")
        .filter((line) => line.trim())
        .map((line) => JSON.parse(line) as Record<string, unknown>);
    },
  };
}

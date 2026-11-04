// What the SCN-INFLITE scenarios share: a LiteLLM proxy that already runs, and the adapter's commands for a gateway
// attached to it. The proxy is the Compose project in proxy/compose.yaml; each helper only calls the adapter's CLI
// through sut, or the proxy's API at the URL that Compose publishes.
import type { ScenarioContext } from "@opensoftware/testkit";
import { provider } from "./gateway.ts";

type Sut = ScenarioContext["sut"];
type Fakes = ScenarioContext["fakes"];

/** The master key of the test proxy, a test value set in proxy/compose.yaml. */
export const MASTER_KEY = "sk-testkit-master";

/** The adapter's variable that holds the master key in these scenarios. */
export const MASTER_KEY_VARIABLE = "OSF_SECRET_PROXY_MASTER_KEY";

/**
 * Starts the test proxy, which routes "routes/triage" to the test provider's model "model-c", and waits until it is
 * healthy. The test provider answers `calls` chat completions. Gives the provider and the proxy's origin.
 */
export async function runningProxy(sut: Sut, fakes: Fakes, calls = 1) {
  const api = await provider(fakes, calls);
  await sut.files.put("$INPUT/.env", `PROVIDER_BASE=${api.containerUrl}/v1\n`);
  const compose = sut.compose("system-tests/proxy/compose.yaml");
  const up = await compose.run(["up", "--detach", "--wait", "--quiet-pull"]);
  if (up.exitCode !== 0) throw new Error(`docker compose up exited with ${up.exitCode}: ${up.stderr}`);
  return { api, origin: await compose.url("litellm", 4000) };
}

/** A config with only `osf.proxy`: the proxy's origin and the reference to the master key's variable. */
export function attachConfig(origin: string, variable = MASTER_KEY_VARIABLE): string {
  return `osf:\n  proxy:\n    url: ${origin}\n    master_key: os.environ/${variable}\n`;
}

/** Runs an adapter command with the master key's variable set to `masterKey`, and the variables of `env`. */
export function cli(sut: Sut, args: string[], masterKey = MASTER_KEY, env: Record<string, string> = {}) {
  return sut.cli(args, { env: { OSF_SECRET_PROXY_MASTER_KEY: masterKey, ...env } });
}

/** Writes the config to $INPUT/config.yaml and runs start with it. */
export async function start(sut: Sut, config: string, masterKey = MASTER_KEY, env: Record<string, string> = {}) {
  await sut.files.put("$INPUT/config.yaml", config);
  return cli(sut, ["start", "config.yaml"], masterKey, env);
}

/** Attaches a gateway to the proxy at `origin`; gives its ID and URL. */
export async function attached(sut: Sut, origin: string): Promise<{ id: string; url: string }> {
  const run = await start(sut, attachConfig(origin));
  if (run.exitCode !== 0) throw new Error(`start exited with ${run.exitCode}: ${run.stderr}`);
  return JSON.parse(run.stdout) as { id: string; url: string };
}

/** A key of the attached gateway for the run. */
export async function runKey(sut: Sut, id: string, run: string): Promise<string> {
  const result = await cli(sut, ["key", id, run]);
  if (result.exitCode !== 0) throw new Error(`key exited with ${result.exitCode}: ${result.stderr}`);
  return result.stdout.trim();
}

/**
 * The test proxy: a fake of LiteLLM's key list, which answers with `status`. Real LiteLLM answers a key that is not
 * its master key with 401.
 */
export function testProxy(fakes: Fakes, status: number) {
  return fakes.http([
    { path: "/key/list?size=1", status, body: status === 200 ? { keys: [] } : { error: { message: "Unauthorized" } } },
  ]);
}

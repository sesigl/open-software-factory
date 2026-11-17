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
 * healthy. The test provider answers `calls` chat completions. `env` sets more variables of proxy/compose.yaml, such
 * as PROXY_BATCH_WRITE_AT. Gives the provider and the proxy's origin.
 */
export async function runningProxy(sut: Sut, fakes: Fakes, calls = 1, env: Record<string, string> = {}) {
  const api = await provider(fakes, calls);
  const lines = Object.entries({ PROVIDER_BASE: `${api.containerUrl}/v1`, ...env }).map(([k, v]) => `${k}=${v}\n`);
  await sut.files.put("$INPUT/.env", lines.join(""));
  const compose = sut.compose("system-tests/proxy/compose.yaml");
  const up = await compose.run(["up", "--detach", "--wait", "--quiet-pull"]);
  if (up.exitCode !== 0) throw new Error(`docker compose up exited with ${up.exitCode}: ${up.stderr}`);
  return { api, origin: await compose.url("litellm", 4000) };
}

/**
 * A config with only `osf.proxy`: the proxy's origin, the reference to the master key's variable and, when one is
 * given, the proxy's write interval as `proxy_batch_write_at`.
 */
export function attachConfig(origin: string, variable = MASTER_KEY_VARIABLE, batchWriteAt?: number | string): string {
  const interval = batchWriteAt === undefined ? "" : `    proxy_batch_write_at: ${batchWriteAt}\n`;
  return `osf:\n  proxy:\n    url: ${origin}\n    master_key: os.environ/${variable}\n${interval}`;
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

/**
 * Attaches a gateway to the proxy at `origin` with the write interval `batchWriteAt`, by default the test proxy's 1
 * second, so that spend-log waits 8 seconds; null names none. Gives the gateway's ID and URL.
 */
export async function attached(
  sut: Sut,
  origin: string,
  batchWriteAt: number | null = 1,
): Promise<{ id: string; url: string }> {
  const run = await start(sut, attachConfig(origin, MASTER_KEY_VARIABLE, batchWriteAt ?? undefined));
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

/**
 * The test proxy with run keys: a fake of LiteLLM's key list, of "/key/generate", which answers with the key
 * "sk-run-7" and its hashed token "token-7", and of "/key/delete".
 */
export function keyProxy(fakes: Fakes) {
  return fakes.http([
    { path: "/key/list?size=1", body: { keys: [] } },
    { method: "POST", path: "/key/generate", body: { key: "sk-run-7", token: "token-7" } },
    { method: "POST", path: "/key/delete", body: { deleted_keys: ["token-7"] } },
  ]);
}

/**
 * The test proxy with keys of two runs: a fake of LiteLLM's key list, of "/key/generate", which answers with the token
 * "token-7" and then "token-8", and of "/key/delete".
 */
export function twoKeysProxy(fakes: Fakes) {
  return fakes.http([
    { path: "/key/list?size=1", body: { keys: [] } },
    { method: "POST", path: "/key/generate", times: 1, body: { key: "sk-run-7", token: "token-7" } },
    { method: "POST", path: "/key/generate", times: 1, body: { key: "sk-run-8", token: "token-8" } },
    { method: "POST", path: "/key/delete", body: { deleted_keys: [] } },
  ]);
}

// start <config> with osf.proxy: attach to a LiteLLM proxy that already runs, such as the litellm service of the
// Compose profile (ADR 0080). No container starts, and the proxy's model routes stay as its own config sets them.
import { randomBytes } from "node:crypto";
import type { Outcome } from "@opensoftware/cli";
import { admin, ready } from "../adapters/litellm.ts";
import { saveRecord } from "../adapters/records.ts";
import type { RunningProxy } from "../domain/config.ts";
import { proxyGateway } from "./gateway.ts";

/** How long start waits for a proxy that is still starting, such as a Compose service next to the client. */
const READY_TIMEOUT_MS = 60_000;

export async function attach(proxy: RunningProxy): Promise<Outcome> {
  const gateway = proxyGateway(proxy);
  const deadline = Date.now() + READY_TIMEOUT_MS;
  while (!(await ready(proxy.origin))) {
    if (Date.now() > deadline) throw new Error(`the proxy at ${proxy.origin} is not ready with its database`);
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  // Only the master key may list keys: a key the proxy does not accept fails here, before any run needs it.
  await admin(gateway, "/key/list?size=1");
  const id = randomBytes(6).toString("hex");
  saveRecord({ id, ...proxy });
  return { lines: [JSON.stringify({ id, url: `${proxy.origin}/v1` })] };
}

// start <config> with osf.proxy: attach to a LiteLLM proxy that already runs, such as the litellm service of the
// Compose profile (ADR 0080). No container starts, and the proxy's model routes stay as its own config sets them.
import { randomBytes } from "node:crypto";
import type { Outcome } from "@opensoftware/cli";
import { admin } from "../adapters/litellm.ts";
import { saveRecord } from "../adapters/records.ts";
import type { RunningProxy } from "../domain/config.ts";
import { proxyGateway } from "./gateway.ts";

export async function attach(proxy: RunningProxy): Promise<Outcome> {
  const gateway = proxyGateway(proxy);
  // The key list needs the proxy's database and its master key: a proxy without either fails here, before any run
  // needs it. start does not wait for a proxy that is still starting; a Compose client waits for its health check.
  await admin(gateway, "/key/list?size=1");
  const id = randomBytes(6).toString("hex");
  saveRecord({ id, ...proxy });
  return { lines: [JSON.stringify({ id, url: `${proxy.origin}/v1` })] };
}

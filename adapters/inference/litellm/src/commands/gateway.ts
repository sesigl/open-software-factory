// What every command after start needs: a gateway that exists, found by its ID, with its address and master key. An
// attached gateway is found by its record in the data folder, a gateway that start ran by its Docker container.
import { check } from "@opensoftware/cli";
import { docker } from "../adapters/docker.ts";
import type { Gateway } from "../adapters/litellm.ts";
import { type AttachedGateway, readRecord } from "../adapters/records.ts";
import type { RunningProxy } from "../domain/config.ts";
import { gatewayName, ID, PROXY_PORT } from "../domain/names.ts";

/** A gateway, with its record when it is attached to a proxy that start did not run. */
export interface FoundGateway extends Gateway {
  record?: AttachedGateway;
}

/** An ID of the wrong form is a usage error. */
export function checkId(id: string | undefined): void {
  check(id && ID.test(id), "name a gateway by the 12 hex digits start printed");
}

/** An ID of the wrong form is a usage error, an unknown one an error. */
export async function findGateway(id: string | undefined): Promise<FoundGateway> {
  checkId(id);
  const record = readRecord(id as string);
  if (record) return { ...proxyGateway(record), record };
  const name = gatewayName(id as string);
  const env = await docker(["container", "inspect", "--format", "{{json .Config.Env}}", name]).catch(() => {
    throw new Error(`no gateway ${id}`);
  });
  const masterKey = (JSON.parse(env) as string[]).find((entry) => entry.startsWith("LITELLM_MASTER_KEY="));
  return { origin: await origin(name), masterKey: (masterKey as string).slice("LITELLM_MASTER_KEY=".length) };
}

/** A proxy that already runs, with the master key from the adapter's variable that the config named. */
export function proxyGateway(proxy: RunningProxy): Gateway {
  const masterKey = process.env[proxy.masterKeyVariable];
  check(masterKey, `set ${proxy.masterKeyVariable} to the master key of the proxy at ${proxy.origin}`);
  return { origin: proxy.origin, masterKey };
}

/** The gateway's address on this host: its published port on 127.0.0.1. */
export async function origin(name: string): Promise<string> {
  const address = (await docker(["port", name, `${PROXY_PORT}/tcp`])).split("\n")[0];
  return `http://${address}`;
}

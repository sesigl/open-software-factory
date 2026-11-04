// stop <ID>: the gateway's proxy, its database with all spend rows and keys, and its network. It finds them by their
// label only, so a gateway whose proxy no longer answers is removed all the same. For an attached gateway, stop
// deletes the run keys it made and its record, and the proxy keeps running.
import type { Outcome } from "@opensoftware/cli";
import { docker } from "../adapters/docker.ts";
import { admin } from "../adapters/litellm.ts";
import { readRecord, removeRecord, tokens } from "../adapters/records.ts";
import { gatewayName, ID_LABEL } from "../domain/names.ts";
import { checkId, proxyGateway } from "./gateway.ts";

export async function stop(id: string | undefined): Promise<Outcome> {
  checkId(id);
  const record = readRecord(id as string);
  if (record) {
    const keys = tokens(record.id);
    if (keys.length > 0) await admin(proxyGateway(record), "/key/delete", { keys });
    removeRecord(record.id);
  } else if ((await removeGateway(id as string)) === 0) throw new Error(`no gateway ${id}`);
  return { lines: [`stopped ${id}`] };
}

/** Removes whatever parts of the gateway exist, with the database's volume; gives how many containers it removed. */
export async function removeGateway(id: string): Promise<number> {
  const parts = await docker(["ps", "--all", "--quiet", "--filter", `label=${ID_LABEL}=${id}`]);
  const containers = parts.split("\n").filter(Boolean);
  if (containers.length > 0) await docker(["rm", "--force", "--volumes", ...containers]);
  await docker(["network", "rm", gatewayName(id)]).catch(() => "");
  return containers.length;
}

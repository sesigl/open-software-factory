// stop <ID>: the gateway's proxy, its database with all spend rows and keys, and its network. It finds them by their
// label only, so a gateway whose proxy no longer answers is removed all the same.
import type { Outcome } from "@opensoftware/cli";
import { docker } from "../adapters/docker.ts";
import { gatewayName, ID_LABEL } from "../domain/names.ts";
import { checkId } from "./gateway.ts";

export async function stop(id: string | undefined): Promise<Outcome> {
  checkId(id);
  if ((await removeGateway(id as string)) === 0) throw new Error(`no gateway ${id}`);
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

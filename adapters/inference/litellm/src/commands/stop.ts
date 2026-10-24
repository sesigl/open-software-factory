// stop <ID>: the gateway's proxy, its database with all spend rows and keys, and its network.
import type { Outcome } from "@opensoftware/cli";
import { docker } from "../adapters/docker.ts";
import { databaseName, gatewayName } from "../domain/names.ts";
import { findGateway } from "./gateway.ts";

export async function stop(id: string | undefined): Promise<Outcome> {
  await findGateway(id);
  await removeGateway(id as string);
  return { lines: [`stopped ${id}`] };
}

/** Removes whatever parts of the gateway exist, with the database's volume. */
export async function removeGateway(id: string): Promise<void> {
  await docker(["rm", "--force", "--volumes", gatewayName(id), databaseName(id)]).catch(() => "");
  await docker(["network", "rm", gatewayName(id)]).catch(() => "");
}

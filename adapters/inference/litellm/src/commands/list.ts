// list: the IDs of the gateways, one per line: the attached gateways in the data folder and the gateways on the
// Docker host.
import type { Outcome } from "@opensoftware/cli";
import { docker } from "../adapters/docker.ts";
import { recordIds } from "../adapters/records.ts";
import { GATEWAY_LABEL, ID_LABEL } from "../domain/names.ts";

export async function list(): Promise<Outcome> {
  const ids = await docker([
    "ps",
    "--all",
    "--filter",
    `label=${GATEWAY_LABEL}`,
    "--format",
    `{{.Label "${ID_LABEL}"}}`,
  ]);
  return { lines: [...recordIds(), ...ids.split("\n").filter(Boolean)].sort() };
}

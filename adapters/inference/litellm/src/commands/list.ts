// list: the IDs of the gateways on the Docker host, one per line.
import type { Outcome } from "@opensoftware/cli";
import { docker } from "../adapters/docker.ts";
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
  return { lines: ids.split("\n").filter(Boolean).sort() };
}

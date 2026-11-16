// list [--label <name>=<value>]: the IDs of the sandboxes on the Docker host, one per line; with a label, only those
// whose spec carried it.
import type { Outcome } from "@opensoftware/cli";
import { dockerText } from "../adapters/docker.ts";
import { ROLE_LABEL, sandboxName } from "../domain/names.ts";

export async function list(label: string | undefined): Promise<Outcome> {
  const filters = [ROLE_LABEL, ...(label ? [label] : [])].flatMap((filter) => ["--filter", `label=${filter}`]);
  const names = await dockerText(["ps", "--all", ...filters, "--format", "{{.Names}}"]);
  const prefix = sandboxName("");
  return {
    lines: names
      .split("\n")
      .filter((name) => name.startsWith(prefix))
      .map((name) => name.slice(prefix.length))
      .sort(),
  };
}

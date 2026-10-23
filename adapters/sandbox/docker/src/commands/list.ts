// list: the IDs of the sandboxes on the Docker host, one per line.
import type { Outcome } from "@opensoftware/cli";
import { dockerText } from "../adapters/docker.ts";
import { ROLE_LABEL, sandboxName } from "../domain/names.ts";

export async function list(): Promise<Outcome> {
  const names = await dockerText(["ps", "--all", "--filter", `label=${ROLE_LABEL}`, "--format", "{{.Names}}"]);
  const prefix = sandboxName("");
  return {
    lines: names
      .split("\n")
      .filter((name) => name.startsWith(prefix))
      .map((name) => name.slice(prefix.length))
      .sort(),
  };
}

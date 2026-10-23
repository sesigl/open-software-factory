// What every command needs: a sandbox that exists, found by its ID.
import { check } from "@opensoftware/cli";
import { docker } from "../adapters/docker.ts";
import { ID, sandboxName } from "../domain/names.ts";

/** The container of the sandbox; an ID of the wrong form is a usage error, an unknown one an error. */
export async function sandboxContainer(id: string | undefined): Promise<string> {
  check(id && ID.test(id), "name a sandbox by the 12 hex digits create printed");
  const name = sandboxName(id as string);
  const found = await docker(["container", "inspect", "--format", "{{.Name}}", name]);
  if (found.code !== 0) throw new Error(`no sandbox ${id}`);
  return name;
}

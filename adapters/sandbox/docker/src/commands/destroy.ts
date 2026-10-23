// destroy <ID>: the sandbox's container with its files, its egress proxy and its network. Snapshots stay.
import type { Outcome } from "@opensoftware/cli";
import { docker } from "../adapters/docker.ts";
import { egressName, sandboxName } from "../domain/names.ts";
import { sandboxContainer } from "./sandbox.ts";

export async function destroy(id: string | undefined): Promise<Outcome> {
  await sandboxContainer(id);
  await destroySandbox(id as string);
  return { lines: [`destroyed ${id}`] };
}

/** Removes whatever parts of the sandbox exist. */
export async function destroySandbox(id: string): Promise<void> {
  await docker(["rm", "--force", "--volumes", sandboxName(id), egressName(id)]);
  await docker(["network", "rm", sandboxName(id)]);
}

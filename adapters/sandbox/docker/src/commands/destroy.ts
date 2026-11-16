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

/**
 * Removes whatever parts of the sandbox exist. A part that is gone already is no failure; a part that Docker does not
 * remove is, and the error names each such part with Docker's reason.
 */
export async function destroySandbox(id: string): Promise<void> {
  const parts: [kind: "container" | "network", name: string, remove: string[]][] = [
    ["container", sandboxName(id), ["rm", "--force", "--volumes"]],
    ["container", egressName(id), ["rm", "--force", "--volumes"]],
    ["network", sandboxName(id), ["network", "rm"]],
  ];
  const left: string[] = [];
  for (const [kind, name, remove] of parts) {
    const removed = await docker([...remove, name]);
    if (removed.code !== 0 && (await docker([kind, "inspect", name])).code === 0)
      left.push(`the ${kind} ${name}: ${removed.stderr.trim()}`);
  }
  if (left.length) throw new Error(`the sandbox ${id} was not removed: ${left.join("; ")}`);
}

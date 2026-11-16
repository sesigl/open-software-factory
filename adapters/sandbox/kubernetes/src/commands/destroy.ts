// destroy <ID>: the sandbox's claim with its Sandbox and pod, its template and warm pool, and its egress pod with
// its configuration and secrets. Snapshots stay.
import type { Outcome } from "@opensoftware/cli";
import { ID_LABEL } from "../domain/names.ts";
import { type Context, sandboxPod } from "./sandbox.ts";

const KINDS = "sandboxclaims,sandboxwarmpools,sandboxtemplates,pods,services,configmaps,secrets";

export async function destroy(context: Context, id: string | undefined): Promise<Outcome> {
  await sandboxPod(context, id);
  await destroySandbox(context, id as string);
  return { lines: [`destroyed ${id}`] };
}

/**
 * Removes whatever objects of the sandbox exist; a selector that finds none is no failure. The claim goes at once, so
 * no command finds the sandbox after this; Kubernetes stops its pods and removes their files in the background, which
 * takes seconds. A delete that the cluster refuses fails with kubectl's error.
 */
export async function destroySandbox({ kube }: Context, id: string): Promise<void> {
  const deleted = await kube.run(["delete", KINDS, "--selector", `${ID_LABEL}=${id}`, "--wait=false"]);
  if (deleted.code !== 0)
    throw new Error(`the sandbox ${id} was not removed: kubectl delete failed: ${deleted.stderr.trim()}`);
}

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

/** Removes whatever objects of the sandbox exist, and waits until its pods and their files are gone. */
export async function destroySandbox({ kube }: Context, id: string): Promise<void> {
  await kube.run(["delete", KINDS, "--selector", `${ID_LABEL}=${id}`, "--cascade=foreground", "--wait=true"]);
}

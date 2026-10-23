// What every command needs: the cluster, and a sandbox that exists, found by its ID.
import { check } from "@opensoftware/cli";
import type { Kubectl } from "../adapters/kubectl.ts";
import { ID, sandboxName } from "../domain/names.ts";
import type { Settings } from "../domain/settings.ts";

export interface Context {
  kube: Kubectl;
  settings: Settings;
}

interface Named {
  metadata: { name: string; annotations?: Record<string, string> };
}

/** The pod of the sandbox; an ID of the wrong form is a usage error, an unknown one an error. */
export async function sandboxPod({ kube }: Context, id: string | undefined): Promise<string> {
  check(id && ID.test(id), "name a sandbox by the 12 hex digits create printed");
  const claim = await kube.get<Named & { status?: { sandbox?: { name?: string } } }>([
    "sandboxclaim",
    sandboxName(id as string),
  ]);
  if (!claim) throw new Error(`no sandbox ${id}`);
  const name = claim.status?.sandbox?.name || claim.metadata.name;
  const sandbox = await kube.get<Named>(["sandbox", name]);
  return sandbox?.metadata.annotations?.["agents.x-k8s.io/pod-name"] || name;
}

/** Waits until `ready` gives a value, for at most `timeoutMs`; `ready` throws to stop at once. */
export async function waitFor<T>(what: string, timeoutMs: number, ready: () => Promise<T | undefined>): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = await ready();
    if (value !== undefined) return value;
    if (Date.now() > deadline) throw new Error(`${what} within ${timeoutMs / 1000} seconds`);
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}

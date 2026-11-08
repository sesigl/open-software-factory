// What every command needs: the cluster, and a sandbox that exists, found by its ID.
import { check } from "@opensoftware/cli";
import type { Kubectl } from "../adapters/kubectl.ts";
import { ID, sandboxName } from "../domain/names.ts";
import type { Settings } from "../domain/settings.ts";

export interface Context {
  kube: Kubectl;
  settings: Settings;
}

/**
 * The pod of the sandbox; an ID of the wrong form is a usage error, an unknown one an error. The claim's warm pool has
 * no replicas, so agent-sandbox starts the sandbox cold: its Sandbox and its pod get the claim's name.
 */
export async function sandboxPod({ kube }: Context, id: string | undefined): Promise<string> {
  check(id && ID.test(id), "name a sandbox by the 12 hex digits create printed");
  const name = sandboxName(id as string);
  if (!(await kube.get(["sandboxclaim", name]))) throw new Error(`no sandbox ${id}`);
  return name;
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

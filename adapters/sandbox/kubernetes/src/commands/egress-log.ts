// egress-log <ID>: one JSON line per request that left the sandbox, from its egress pod's audit log.
import type { Outcome } from "@opensoftware/cli";
import { egressEntries } from "@opensoftware/sandbox-egress";
import { egressName } from "../domain/names.ts";
import { type Context, sandboxPod } from "./sandbox.ts";

export async function egressLog(context: Context, id: string | undefined): Promise<Outcome> {
  await sandboxPod(context, id);
  const logs = await context.kube.text(["logs", egressName(id as string)]);
  return { lines: egressEntries(logs).map((entry) => JSON.stringify(entry)) };
}

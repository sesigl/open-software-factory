// egress-log <ID>: one JSON line per request that left the sandbox, from its egress proxy's audit log.
import type { Outcome } from "@opensoftware/cli";
import { docker } from "../adapters/docker.ts";
import { egressEntries } from "../domain/egress-log.ts";
import { egressName } from "../domain/names.ts";
import { sandboxContainer } from "./sandbox.ts";

export async function egressLog(id: string | undefined): Promise<Outcome> {
  await sandboxContainer(id);
  const logs = await docker(["logs", egressName(id as string)]);
  return { lines: egressEntries(logs.stdout.toString("utf8") + logs.stderr).map((entry) => JSON.stringify(entry)) };
}

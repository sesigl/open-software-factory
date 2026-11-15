// copy <from> <to>: a file or folder into or out of a sandbox with kubectl cp; the sandbox's side is <ID>:<path>.
import { type Outcome, UsageError } from "@opensoftware/cli";
import { copyEnds } from "@opensoftware/contracts";
import { type Context, sandboxPod } from "./sandbox.ts";

export async function copy(context: Context, from: string | undefined, to: string | undefined): Promise<Outcome> {
  const ends = copyEnds(from, to);
  if ("problem" in ends) throw new UsageError(ends.problem);
  const { id, inSandbox, local, into } = ends;
  // kubectl cp runs tar in the sandbox as the sandbox's user, so what is copied in belongs to that user.
  const remote = `${await sandboxPod(context, id)}:${inSandbox}`;
  await context.kube.text(["cp", ...(into ? [local, remote] : [remote, local])]);
  return { lines: [`copied ${from} to ${to}`] };
}

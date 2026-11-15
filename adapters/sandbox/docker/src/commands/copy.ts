// copy <from> <to>: a file or folder into or out of a sandbox; the sandbox's side is <ID>:<path>.
import { type Outcome, UsageError } from "@opensoftware/cli";
import { copyEnds, SANDBOX_WORKSPACE } from "@opensoftware/contracts";
import { dockerText } from "../adapters/docker.ts";
import { sandboxContainer } from "./sandbox.ts";

export async function copy(from: string | undefined, to: string | undefined): Promise<Outcome> {
  const ends = copyEnds(from, to);
  if ("problem" in ends) throw new UsageError(ends.problem);
  const { id, inSandbox, local, into } = ends;
  const container = await sandboxContainer(id);
  if (!into) {
    await dockerText(["cp", `${container}:${inSandbox}`, local]);
  } else {
    await dockerText(["cp", local, `${container}:${inSandbox}`]);
    // docker cp gives the files to root; the sandbox's user owns its working folder and what is copied into it.
    const owner = ["sh", "-c", `chown -R "$(stat -c %u:%g ${SANDBOX_WORKSPACE})" "$1"`, "sh", inSandbox];
    await dockerText(["exec", "--user", "0", container, ...owner]);
  }
  return { lines: [`copied ${from} to ${to}`] };
}

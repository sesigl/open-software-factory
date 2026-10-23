// copy <from> <to>: a file or folder into or out of a sandbox; the sandbox's side is <ID>:<path>.
import type { Outcome } from "@opensoftware/cli";
import { copyEnds, WORKSPACE } from "@opensoftware/sandbox-egress";
import { dockerText } from "../adapters/docker.ts";
import { sandboxContainer } from "./sandbox.ts";

export async function copy(from: string | undefined, to: string | undefined): Promise<Outcome> {
  const { id, inSandbox, local, into } = copyEnds(from, to);
  const container = await sandboxContainer(id);
  if (!into) {
    await dockerText(["cp", `${container}:${inSandbox}`, local]);
  } else {
    await dockerText(["cp", local, `${container}:${inSandbox}`]);
    // docker cp gives the files to root; the sandbox's user owns its working folder and what is copied into it.
    const owner = ["sh", "-c", `chown -R "$(stat -c %u:%g ${WORKSPACE})" "$1"`, "sh", inSandbox];
    await dockerText(["exec", "--user", "0", container, ...owner]);
  }
  return { lines: [`copied ${from} to ${to}`] };
}

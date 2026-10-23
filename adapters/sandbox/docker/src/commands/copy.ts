// copy <from> <to>: a file or folder into or out of a sandbox; the sandbox's side is <ID>:<path>.
import { posix } from "node:path";
import { check, type Outcome } from "@opensoftware/cli";
import { dockerText } from "../adapters/docker.ts";
import { WORKSPACE } from "../domain/names.ts";
import { sandboxContainer } from "./sandbox.ts";

const IN_SANDBOX = /^([0-9a-f]{12}):(.+)$/;

export async function copy(from: string | undefined, to: string | undefined): Promise<Outcome> {
  check(from && to, "name what to copy and where to, like copy notes.md <ID>:notes.md");
  const source = IN_SANDBOX.exec(from as string);
  const target = IN_SANDBOX.exec(to as string);
  check(Boolean(source) !== Boolean(target), "name the sandbox on one side only, as <ID>:<path>");
  if (source) {
    const container = await sandboxContainer(source[1]);
    await dockerText(["cp", `${container}:${inWorkspace(source[2] as string)}`, to as string]);
  } else {
    const container = await sandboxContainer(target?.[1]);
    const path = inWorkspace(target?.[2] as string);
    await dockerText(["cp", from as string, `${container}:${path}`]);
    // docker cp gives the files to root; the sandbox's user owns its working folder and what is copied into it.
    const owner = ["sh", "-c", `chown -R "$(stat -c %u:%g ${WORKSPACE})" "$1"`, "sh", path];
    await dockerText(["exec", "--user", "0", container, ...owner]);
  }
  return { lines: [`copied ${from} to ${to}`] };
}

const inWorkspace = (path: string): string => posix.resolve(WORKSPACE, path);

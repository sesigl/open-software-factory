// The two ends of `copy <from> <to>`, the same for every sandbox adapter: the sandbox's side is <ID>:<path>, and a
// relative path there is below the working folder.
import { posix } from "node:path";
import { check } from "@opensoftware/cli";
import { WORKSPACE } from "./names.ts";

export interface CopyEnds {
  /** The sandbox's ID. */
  id: string;
  /** The absolute path in the sandbox. */
  inSandbox: string;
  /** The path on the client's side, as given. */
  local: string;
  /** Whether the copy goes into the sandbox. */
  into: boolean;
}

const IN_SANDBOX = /^([0-9a-f]{12}):(.+)$/;

/** The ends of a copy; a usage error unless exactly one side names a sandbox. */
export function copyEnds(from: string | undefined, to: string | undefined): CopyEnds {
  check(from && to, "name what to copy and where to, like copy notes.md <ID>:notes.md");
  const source = IN_SANDBOX.exec(from as string);
  const target = IN_SANDBOX.exec(to as string);
  check(Boolean(source) !== Boolean(target), "name the sandbox on one side only, as <ID>:<path>");
  const [, id, path] = (source ?? target) as RegExpExecArray;
  return {
    id: id as string,
    inSandbox: posix.resolve(WORKSPACE, path as string),
    local: (source ? to : from) as string,
    into: !source,
  };
}

// The sandbox port's command line as its adapters and clients share it (ADR 0054, ADR 0147): the working folder of
// every sandbox, and the two ends of `copy <from> <to>`, whose sandbox side is `<ID>:<path>`.
import { posix } from "node:path";

/** The working folder of every command in a sandbox. */
export const SANDBOX_WORKSPACE = "/workspace";

/** The two ends of a copy. */
export interface CopyEnds {
  /** The sandbox's ID. */
  id: string;
  /** The absolute path in the sandbox; a relative path is below the working folder. */
  inSandbox: string;
  /** The path on the client's side, as given. */
  local: string;
  /** Whether the copy goes into the sandbox. */
  into: boolean;
}

const IN_SANDBOX = /^([0-9a-f]{12}):(.+)$/;

/** The ends of `copy <from> <to>`, or the problem when not exactly one side names a sandbox. */
export function copyEnds(from: string | undefined, to: string | undefined): CopyEnds | { problem: string } {
  if (!from || !to) return { problem: "name what to copy and where to, like copy notes.md <ID>:notes.md" };
  const source = IN_SANDBOX.exec(from);
  const target = IN_SANDBOX.exec(to);
  if (Boolean(source) === Boolean(target)) return { problem: "name the sandbox on one side only, as <ID>:<path>" };
  const [, id, path] = (source ?? target) as RegExpExecArray;
  return {
    id: id as string,
    inSandbox: posix.resolve(SANDBOX_WORKSPACE, path as string),
    local: source ? to : from,
    into: !source,
  };
}

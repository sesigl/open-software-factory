// The access file `access.yaml` (ADR 0134): who may sign in, with one role each, read again at each request, so a merge
// that removes a person ends their access without a restart. A file that cannot be read keeps the last good one for
// ten minutes, then refuses everyone. The console reads it itself until @opensoftware/factory-files is published.
import { readFileSync } from "node:fs";
import { type Access, type AccessRole, validate } from "@opensoftware/contracts";
import { parse } from "yaml";

export type Role = AccessRole;

export interface AccessList {
  /** The role of the email, compared in lower case. */
  roleOf(email: string): Role | undefined;
  /** Why nobody signs in, like "access.yaml: no person has the role admin"; empty when the list holds. */
  problems: string[];
}

const KEEP_MS = 10 * 60 * 1000;

/** The problems of the file, or its people by their email in lower case. */
function read(file: string): { people?: Map<string, Role>; problems: string[] } {
  let document: unknown;
  try {
    document = parse(readFileSync(file, "utf8"));
  } catch (error) {
    const reason = (error as NodeJS.ErrnoException).code === "ENOENT" ? "no such file" : (error as Error).message;
    return { problems: [`${file}: ${reason.split("\n")[0]}`] };
  }
  const problems = validate("access", document).map((problem) => `${file} ${problem.path}: ${problem.message}`);
  if (problems.length) return { problems };
  const people = new Map((document as Access).people.map((person) => [person.email.toLowerCase(), person.role]));
  if (![...people.values()].includes("admin")) return { problems: [`${file}: no person has the role admin`] };
  return { people, problems: [] };
}

/** The access list of the file, read again at each call of `current`. */
export function accessFile(file: string, now: () => number): { current(): AccessList } {
  let last: { people: Map<string, Role>; at: number } | undefined;
  return {
    current() {
      const found = read(file);
      if (found.people) last = { people: found.people, at: now() };
      const people = found.people ?? (last && now() - last.at < KEEP_MS ? last.people : undefined);
      return {
        roleOf: (email) => people?.get(email.toLowerCase()),
        problems: people ? [] : found.problems,
      };
    },
  };
}

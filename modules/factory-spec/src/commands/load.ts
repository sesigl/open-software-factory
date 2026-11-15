// Loads factory.yaml for every command: lint first, then the lock next to it.
import { dirname, join, resolve } from "node:path";
import type { FactoryDefinition } from "@opensoftware/contracts";
import { exists, filesBelow, readLock, readText } from "../adapters/files.ts";
import { accessProblems } from "../domain/access.ts";
import { FactoryError } from "../domain/errors.ts";
import { lint, type Problem } from "../domain/lint.ts";
import type { Lock } from "../domain/mcp.ts";
import { resolveDefinition } from "../domain/resolve.ts";

export interface Factory {
  /** The folder of factory.yaml; every path in it is relative to this folder. */
  dir: string;
  definition: FactoryDefinition;
  lock: Lock;
}

/**
 * Lints the file, or the text given for it; each problem and each warning is one line "factory.yaml:12:9 message".
 */
export function lintFile(
  file: string,
  ghAw = false,
  text = readText(file),
): { dir: string; definition?: FactoryDefinition; problems: string[]; warnings: string[] } {
  const dir = dirname(resolve(file));
  const { definition, problems, warnings } = lint(
    text,
    (path) => exists(join(dir, path)),
    (path) => filesBelow(join(dir, path)),
    ghAw,
  );
  // A problem in a skill's file names it as factory.yaml is named: relative to the current folder, or absolute.
  const lines = (found: Problem[]) =>
    found.map(
      (problem) =>
        `${problem.file ? join(dirname(file), problem.file) : file}:${problem.line}:${problem.column} ${problem.message}`,
    );
  return { dir, definition, problems: lines(problems), warnings: lines(warnings) };
}

/** The problems of the access file beside factory.yaml, when there is one: the console's sign-in reads it (ADR 0134). */
export function lintAccess(file: string): string[] {
  const access = join(dirname(file), "access.yaml");
  return exists(access) ? accessProblems(readText(access), access) : [];
}

export function load(file: string): Factory {
  const { dir, definition, problems } = lintFile(file);
  if (!definition) throw new FactoryError(problems.join("\n"));
  return { dir, definition, lock: readLock(dir) };
}

/** The resolved factory-definition of a factory.yaml: defaults filled in, registry servers pinned by factory.lock. */
export function resolveFactory(file = "factory.yaml"): FactoryDefinition {
  const factory = load(file);
  return resolveDefinition(factory.definition, factory.lock);
}

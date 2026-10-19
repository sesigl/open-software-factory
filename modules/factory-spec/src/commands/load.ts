// Loads factory.yaml for every command: lint first, then the lock next to it.
import { dirname, join, resolve } from "node:path";
import type { FactoryDefinition } from "@opensoftware/contracts";
import { exists, readLock, readText } from "../adapters/files.ts";
import { FactoryError } from "../domain/errors.ts";
import { lint } from "../domain/lint.ts";
import type { Lock } from "../domain/mcp.ts";
import { resolveDefinition } from "../domain/resolve.ts";

export interface Factory {
  /** The folder of factory.yaml; every path in it is relative to this folder. */
  dir: string;
  definition: FactoryDefinition;
  lock: Lock;
}

/** Lints the file; each problem is one line "factory.yaml:12:9 message". */
export function lintFile(file: string): { dir: string; definition?: FactoryDefinition; problems: string[] } {
  const dir = dirname(resolve(file));
  const { definition, problems } = lint(readText(file), (path) => exists(join(dir, path)));
  return {
    dir,
    definition,
    problems: problems.map((problem) => `${file}:${problem.line}:${problem.column} ${problem.message}`),
  };
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

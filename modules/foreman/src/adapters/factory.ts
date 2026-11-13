// Reads the factory (ADR 0067): factory.yaml, checked against the contract and for its stages' agents, the text of
// each agent's prompt, and the factory version, the commit of the folder that holds the file, which must be clean
// (ADR 0110).
import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import { basename, dirname, relative, resolve } from "node:path";
import { promisify } from "node:util";
import { UsageError } from "@opensoftware/cli";
import { type FactoryDefinition, validate } from "@opensoftware/contracts";
import { parse } from "yaml";
import { type Definition, definitionOf, stageProblems } from "../domain/definition.ts";

export interface Factory {
  definition: Definition;
  /** The commit of the factory definition. */
  version: string;
}

/** The factory at `path`; a file that cannot run is a usage error that names the file, the path in it and why. */
export async function readFactory(path: string): Promise<Factory> {
  const file = resolve(path);
  const name = basename(file);
  const document: unknown = parse(readFileSync(file, "utf8"));
  const contract = validate("factory-definition", document);
  const problems = contract.length ? contract : stageProblems(document as FactoryDefinition);
  if (problems.length)
    throw new UsageError(problems.map((problem) => `${name}: ${problem.path}: ${problem.message}`).join("\n"));
  const folder = dirname(file);
  const version = await commitOf(folder, name);
  await mustBeClean(folder, name, filesOf(document as FactoryDefinition, folder, file));
  const read = (prompt: string) => readFileSync(resolve(folder, prompt), "utf8");
  return { definition: definitionOf(document as FactoryDefinition, read), version };
}

/** The files the foreman reads, relative to the factory's folder: factory.yaml, the prompts and the inference config. */
function filesOf(factory: FactoryDefinition, folder: string, file: string): string[] {
  const prompts = Object.values(factory.agents ?? {}).map((agent) => agent.prompt);
  const config = factory.inference?.config;
  return [file, ...prompts.map((prompt) => resolve(folder, prompt)), ...(config ? [resolve(folder, config)] : [])].map(
    (path) => relative(folder, path),
  );
}

/**
 * Refuses a folder with changes that are not committed: a tracked file of the folder that differs from HEAD, or a
 * file the foreman reads that Git does not track (ADR 0110).
 */
async function mustBeClean(folder: string, name: string, read: string[]): Promise<void> {
  const git = (...args: string[]) =>
    promisify(execFile)("git", args, { cwd: folder }).then(({ stdout }) => stdout.split("\0").filter(Boolean));
  const changed = await git("diff", "HEAD", "--name-only", "--relative", "-z", "--", ".");
  const untracked = await git("ls-files", "--others", "--exclude-standard", "-z", "--", ...read);
  const files = [...new Set([...changed, ...untracked])].sort();
  if (files.length)
    throw new UsageError(
      `${name}: commit the changed files ${files.join(", ")}; a run's factory version is its commit`,
    );
}

async function commitOf(folder: string, name: string): Promise<string> {
  try {
    const { stdout } = await promisify(execFile)("git", ["rev-parse", "HEAD"], { cwd: folder });
    return stdout.trim();
  } catch {
    throw new UsageError(`${name}: commit it in a Git repository; a run's factory version is that commit`);
  }
}

// Reads the factory (ADR 0067): factory.yaml, checked against the contract and for its stages' agents, the text of
// each agent's prompt, and the factory version, the commit of the folder that holds the file.
import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
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
  const read = (prompt: string) => readFileSync(resolve(folder, prompt), "utf8");
  return { definition: definitionOf(document as FactoryDefinition, read), version: await commitOf(folder, name) };
}

async function commitOf(folder: string, name: string): Promise<string> {
  try {
    const { stdout } = await promisify(execFile)("git", ["rev-parse", "HEAD"], { cwd: folder });
    return stdout.trim();
  } catch {
    throw new UsageError(`${name}: commit it in a Git repository; a run's factory version is that commit`);
  }
}

// Reads the factory (ADR 0067): factory.yaml, checked against the contract and for its stages' agents, the text of
// each agent's prompt, the files of its skills and its MCP servers with their pins in factory.lock (ADR 0112), and the
// factory version, the commit of the folder that holds the file, which must be clean (ADR 0110), or the commit of a
// Git remote that @opensoftware/factory-source fetched (ADR 0124, ADR 0142). A skill of another Git repository is
// fetched with the same library at the commit factory.lock pins, and its files must have the pin's hash (ADR 0146).
import { execFile } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { promisify } from "node:util";
import { UsageError } from "@opensoftware/cli";
import { type FactoryDefinition, validate } from "@opensoftware/contracts";
import { FetchError, type Pin, pinnedFolder, factorySource as sourceOf } from "@opensoftware/factory-source";
import { parse } from "yaml";
import { type Definition, definitionOf, stageProblems } from "../domain/definition.ts";

/**
 * The factory cannot be read now and may be soon: its folder has changes that are not committed. A request that needs
 * it is refused, and an event that needs it comes again. At the start of the server it stops the server, as every
 * usage error does.
 */
export class FactoryNotReadable extends UsageError {}

/** The factory's Git remote cannot be fetched now: the API answers 503. */
export class FactoryUnreachable extends FactoryNotReadable {}

export interface Factory {
  definition: Definition;
  /** The commit of the factory definition. */
  version: string;
}

/** Where the foreman reads the factory: a local file, or `git+<url>#<ref>` with factory.yaml at the root (ADR 0124). */
export interface FactorySource {
  /** The folder of the factory that `read` read last; the gateway's config is below it. */
  folder(): string;
  read(): Promise<Factory>;
}

/**
 * The source that `FOREMAN_FACTORY` names; @opensoftware/factory-source fetches a remote into `data`/factory, with
 * `token` for a private one (ADR 0142).
 */
export function factorySource(setting: string, data: string, token: string | undefined): FactorySource {
  // Stryker disable next-line StringLiteral: the cache is the foreman's private data, which no test may read
  const source = sourceOf(setting, { cache: join(data, "factory"), token });
  let folder = "";
  return {
    folder: () => folder,
    read: async () => {
      const fetched = await source.fetch().catch((failure: unknown) => {
        throw failure instanceof FetchError ? new FactoryUnreachable(`FOREMAN_FACTORY: ${failure.message}`) : failure;
      });
      folder = resolve(fetched.folder);
      // Stryker disable next-line StringLiteral: the cache is the foreman's private data, which no test may read
      return readFactory(fetched.file, join(data, "skills"), fetched.commit);
    },
  };
}

/**
 * The factory at `path`; a file that cannot run is a usage error that names the file, the path in it and why. With
 * `commit`, the file is a fetched commit and that commit is its version; else its folder must be clean. The skills of
 * other repositories are fetched into `skills`, the cache of their repositories.
 */
export async function readFactory(path: string, skills: string, commit?: string): Promise<Factory> {
  const file = resolve(path);
  const name = basename(file);
  const document: unknown = parse(readFileSync(file, "utf8"));
  const contract = validate("factory-definition", document);
  const problems = contract.length ? contract : stageProblems(document as FactoryDefinition);
  if (problems.length)
    throw new UsageError(problems.map((problem) => `${name}: ${problem.path}: ${problem.message}`).join("\n"));
  const folder = dirname(file);
  const version = commit ?? (await mustBeClean(folder, name, filesOf(document as FactoryDefinition, folder, file)));
  const read = (path: string) => readFileSync(resolve(folder, path), "utf8");
  const lock = join(folder, "factory.lock");
  const { mcp: pins = {}, adapters = {}, skills: pinned = {} } = existsSync(lock) ? JSON.parse(read(lock)) : {};
  const fetched = await skillFolders(document as FactoryDefinition, pinned, skills, name);
  const files = { read, folder: (path: string) => filesBelow(fetched[path] ?? resolve(folder, path)), pins, adapters };
  return { definition: definitionOf(document as FactoryDefinition, files), version };
}

/**
 * The folder of each skill of another repository, `git+<url>#<ref>:<path>`, fetched at the commit of its pin in
 * factory.lock, by its entry. An entry without a pin, a pin of another entry, a fetch that fails and files whose hash
 * is not the pin's are each a usage error that names the file.
 */
async function skillFolders(
  factory: FactoryDefinition,
  pins: Record<string, Pin & { source: string }>,
  cache: string,
  name: string,
): Promise<Record<string, string>> {
  const folders: Record<string, string> = {};
  for (const agent of Object.values(factory.agents))
    for (const entry of (agent.skills ?? []).filter((skill) => skill.startsWith("git+"))) {
      const skill = entry.split("/").filter(Boolean).pop() as string;
      const pin = pins[skill];
      if (pin?.source !== entry)
        throw new UsageError(
          `${name}: factory.lock has no pin of the skill "${skill}" for "${entry}": run "factory plan"`,
        );
      // A skill's fetch also fails for a folder that is not there or files whose hash is not the pin's: a usage error.
      const fetched = await pinnedFolder(entry, { cache, pin }).catch((failure: unknown) => {
        throw failure instanceof FetchError ? new UsageError(`${name}: ${failure.message}`) : failure;
      });
      folders[entry] = fetched.folder;
    }
  return folders;
}

/** The text of every file below the folder, by its path relative to it (ADR 0112). */
function filesBelow(folder: string): Record<string, string> {
  const entries = readdirSync(folder, { recursive: true, withFileTypes: true }).filter((entry) => entry.isFile());
  return Object.fromEntries(
    entries.map((entry) => {
      const path = join(entry.parentPath, entry.name);
      return [relative(folder, path), readFileSync(path, "utf8")];
    }),
  );
}

/** The files the foreman reads, relative to the factory's folder: factory.yaml, the prompts and the inference config. */
function filesOf(factory: FactoryDefinition, folder: string, file: string): string[] {
  const prompts = Object.values(factory.agents ?? {}).map((agent) => agent.prompt);
  return [file, ...prompts, factory.inference?.config]
    .filter((path): path is string => path !== undefined)
    .map((path) => relative(folder, resolve(folder, path)));
}

/**
 * The commit of the folder, which must have no changes that are not committed: a tracked file of the folder that
 * differs from HEAD, or a file the foreman reads that Git does not track (ADR 0110). Two Git processes at once, as
 * this runs at the start of the server, of a run and of a retry.
 */
async function mustBeClean(folder: string, name: string, read: string[]): Promise<string> {
  const git = (...args: string[]) =>
    promisify(execFile)("git", ["--no-optional-locks", ...args], { cwd: folder }).then(({ stdout }) => stdout);
  // Outside a Git repository both fail.
  const [head, status] = await Promise.all([
    git("rev-parse", "--show-prefix", "HEAD"),
    git("status", "--porcelain", "-z", "--no-renames", "--untracked-files=all", "--", "."),
  ]).catch(() => {
    throw new UsageError(`${name}: commit it in a Git repository; a run's factory version is that commit`);
  });
  const [prefix, version] = head.split("\n") as [string, string];
  const reads = new Set(read);
  const files = new Set<string>();
  // Each entry is "XY path", the path relative to the repository's root; "??" is a file that Git does not track.
  for (const entry of status.split("\0").filter(Boolean)) {
    const path = entry.slice(3 + prefix.length);
    if (!entry.startsWith("??") || reads.has(path)) files.add(path);
  }
  if (files.size)
    throw new FactoryNotReadable(
      `${name}: commit the changed files ${[...files].sort().join(", ")}; a run's factory version is its commit`,
    );
  return version;
}

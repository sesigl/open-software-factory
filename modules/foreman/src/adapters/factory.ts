// Reads the factory (ADR 0067): factory.yaml, checked against the contract and for its stages' agents, the text of
// each agent's prompt, the files of its skills and its MCP servers with their pins in factory.lock (ADR 0112), and the
// factory version, the commit of the folder that holds the file, which must be clean (ADR 0110), or the commit of a
// Git remote that the foreman fetched (ADR 0124).
import { execFile } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
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

/** Where the foreman reads the factory: a local file, or `git+<url>#<ref>` with factory.yaml at the root (ADR 0124). */
export interface FactorySource {
  /** The folder of the factory that `read` read last; the gateway's config is below it. */
  folder(): string;
  read(): Promise<Factory>;
}

const GIT = /^git\+(.+?)(?:#(.+))?$/;

/** The source that `FOREMAN_FACTORY` names; a remote is fetched into `data`/factory. */
export function factorySource(setting: string, data: string): FactorySource {
  const remote = GIT.exec(setting);
  if (!remote) {
    const file = resolve(setting);
    return { folder: () => dirname(file), read: () => readFactory(file) };
  }
  const [, url, ref = "HEAD"] = remote as unknown as [string, string, string?];
  const store = join(data, "factory");
  let folder = "";
  // One fetch at a time, as runs start at once and share the repository.
  let queue: Promise<unknown> = Promise.resolve();
  const read = async () => {
    const commit = await fetchCommit(url, ref, store);
    folder = join(store, commit);
    return readFactory(join(folder, "factory.yaml"), commit);
  };
  return {
    folder: () => folder,
    read: () => {
      const next = queue.then(read);
      queue = next.catch(() => undefined);
      return next;
    },
  };
}

/** Fetches `ref` of `url` into a bare repository below `store` and writes its files to `store`/<commit>. */
async function fetchCommit(url: string, ref: string, store: string): Promise<string> {
  const bare = join(store, "repository.git");
  const git = (...args: string[]) =>
    promisify(execFile)("git", ["--git-dir", bare, ...args]).then(({ stdout }) => stdout.trim());
  mkdirSync(store, { recursive: true });
  // Again on a repository that exists, git init changes nothing.
  await promisify(execFile)("git", ["init", "--quiet", "--bare", bare]);
  const commit = await git("fetch", "--quiet", "--no-tags", "--end-of-options", url, ref)
    .then(() => git("rev-parse", "--verify", "FETCH_HEAD^{commit}"))
    .catch((failure: { stderr: string }) => {
      throw new UsageError(`FOREMAN_FACTORY: cannot fetch ${ref} of ${url}: ${failure.stderr.trim()}`);
    });
  const folder = join(store, commit);
  if (!existsSync(folder)) {
    const partial = `${folder}.partial`;
    // A folder that a stopped server left half written is written again.
    mkdirSync(partial, { recursive: true });
    await git("--work-tree", partial, "checkout", "--quiet", commit, "--", ".");
    renameSync(partial, folder);
  }
  return commit;
}

/**
 * The factory at `path`; a file that cannot run is a usage error that names the file, the path in it and why. With
 * `commit`, the file is a fetched commit and that commit is its version; else its folder must be clean.
 */
export async function readFactory(path: string, commit?: string): Promise<Factory> {
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
  const pins = existsSync(lock) ? JSON.parse(read(lock)).mcp : {};
  const files = { read, folder: (path: string) => filesBelow(resolve(folder, path)), pins };
  return { definition: definitionOf(document as FactoryDefinition, files), version };
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
    throw new UsageError(
      `${name}: commit the changed files ${[...files].sort().join(", ")}; a run's factory version is its commit`,
    );
  return version;
}

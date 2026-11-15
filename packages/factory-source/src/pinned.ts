// A folder of another Git repository (ADR 0146): git+<url>#<ref>:<path>, fetched at its ref to pin it, or at the
// commit of its pin, whose files must have the pin's hash.
import { createHash } from "node:crypto";
import { existsSync, lstatSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { FetchError, fetchCommit, named } from "./git.ts";
import type { SourceOptions } from "./source.ts";

/** A commit and the hash of the files of the folder at that commit, as factory.lock holds them. */
export interface Pin {
  /** The full commit, 40 or 64 hexadecimal characters. */
  commit: string;
  /** The hash of the folder's files in the form of Go's modules: "h1:" and the base64 of a SHA-256. */
  hash: string;
}

export interface PinnedFolder extends Pin {
  /** The folder below the commit's files in the cache. */
  folder: string;
}

export interface PinnedOptions extends SourceOptions {
  /** Fetch this commit and not the ref, and refuse files whose hash is not the pin's. */
  pin?: Pin;
}

const REFERENCE = /^git\+(.+?)#([^:]+):(.+)/;

/** One fetch at a time per repository of a cache, in this process: fetches share the bare repository. */
const queues = new Map<string, Promise<unknown>>();

/**
 * The folder that `reference` names, `git+<url>#<ref>:<path>`, below `cache`, which holds one folder per repository.
 * Without a pin it fetches the ref and gives its commit and hash; with a pin it fetches the pin's commit, only when the
 * cache does not hold it yet, and checks its hash. Each failure is a FetchError.
 */
export async function pinnedFolder(reference: string, options: PinnedOptions): Promise<PinnedFolder> {
  const parts = REFERENCE.exec(reference);
  if (!parts) throw new FetchError(`"${named(reference)}" is no git+<url>#<ref>:<path>`);
  const [, url, ref, path] = parts as unknown as [string, string, string, string];
  if (path.split("/").includes("..") || path.startsWith("/"))
    throw new FetchError(`"${named(reference)}" names a folder outside its repository`);
  const repository = join(options.cache, createHash("sha256").update(url).digest("hex").slice(0, 16));
  const { pin, token } = options;
  const fetch = async (): Promise<PinnedFolder> => {
    // Stryker disable next-line ConditionalExpression: Git fetches a commit its bare repository holds without the remote
    const cached = pin && existsSync(join(repository, pin.commit));
    const commit = cached ? pin.commit : await fetchCommit(url, pin?.commit ?? ref, repository, token);
    const files = join(repository, commit);
    const folder = join(files, path);
    const link = linkOn(files, path);
    if (link) throw new FetchError(`the commit ${commit} of ${named(url)} has the symbolic link ${link} at ${path}`);
    if (!existsSync(folder) || !statSync(folder).isDirectory())
      throw new FetchError(`the commit ${commit} of ${named(url)} has no folder ${path}`);
    const hash = hashOf(folder);
    if (pin && hash !== pin.hash)
      throw new FetchError(
        `the folder ${path} of ${named(url)} at ${commit} has the hash ${hash}, not the hash ${pin.hash} of its pin`,
      );
    return { folder, commit, hash };
  };
  const next = (queues.get(repository) ?? Promise.resolve()).then(fetch);
  // Stryker disable next-line all: two fetches at once of one bare repository fail only now and then
  queues.set(
    repository,
    next.catch(() => undefined),
  );
  return await next;
}

/**
 * The first symbolic link on the way to the folder `path` below `files` or inside it, as its path below `files`. Git
 * writes a link of a commit as a link, and one may point anywhere on this machine: whoever reads the folder would read
 * files that are not the repository's, and the hash would not cover them.
 */
function linkOn(files: string, path: string): string | undefined {
  const isLink = (below: string) => lstatSync(join(files, below), { throwIfNoEntry: false })?.isSymbolicLink();
  const parts = path.split("/").filter(Boolean);
  const above = parts.map((_, index) => parts.slice(0, index + 1).join("/")).find(isLink);
  if (above || !existsSync(join(files, path))) return above;
  const inside = readdirSync(join(files, path), { recursive: true, withFileTypes: true }).find((entry) =>
    entry.isSymbolicLink(),
  );
  return inside && relative(files, join(inside.parentPath, inside.name)).split(sep).join("/");
}

/** Go's dirhash "h1": the SHA-256 of one line "<SHA-256 of the file>  <path>\n" per file, sorted by path. */
function hashOf(folder: string): string {
  const paths = readdirSync(folder, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => relative(folder, join(entry.parentPath, entry.name)).split(sep).join("/"))
    .sort();
  const sum = (bytes: Buffer | string) => createHash("sha256").update(bytes);
  const lines = paths.map((path) => `${sum(readFileSync(join(folder, path))).digest("hex")}  ${path}\n`);
  return `h1:${sum(lines.join("")).digest("base64")}`;
}

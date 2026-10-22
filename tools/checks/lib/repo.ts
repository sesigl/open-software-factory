import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import picomatch from "picomatch";

export interface Finding {
  check: string;
  file?: string;
  line?: number;
  message: string;
}

export class Repo {
  readonly root: string;
  #files: string[] | undefined;

  constructor(root: string) {
    this.root = root;
  }

  /** Every file Git would track (committed or not), relative to the root, with forward slashes. */
  files(): string[] {
    if (this.#files) return this.#files;
    const git = spawnSync("git", ["ls-files", "-co", "--exclude-standard", "-z"], { cwd: this.root, encoding: "utf8" });
    const listed =
      git.status === 0
        ? git.stdout.split("\0").filter(Boolean)
        : walk(this.root).map((file) => relative(this.root, file));
    this.#files = [...new Set(listed.map((file) => file.split("\\").join("/")))]
      .filter((file) => existsSync(join(this.root, file)))
      .sort();
    return this.#files;
  }

  /** Files matching the globs. */
  match(...globs: string[]): string[] {
    const isMatch = picomatch(globs, { dot: true });
    return this.files().filter((file) => isMatch(file));
  }

  /** Paths are relative to the root; an absolute path (for example from OSF_PR_BODY) is used as is. */
  read(file: string): string {
    return readFileSync(resolve(this.root, file), "utf8");
  }

  exists(file: string): boolean {
    return existsSync(resolve(this.root, file));
  }
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === ".git" || entry === "node_modules") continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

/** 1-based line of the first occurrence of `needle` in `text`, or 1. */
export function lineOf(text: string, needle: string): number {
  const index = text.indexOf(needle);
  return index < 0 ? 1 : text.slice(0, index).split("\n").length;
}

/** The module root of a path: `modules/proof`, `tools`, `adapters/forge/github`, `e2e`. */
export function moduleRootOf(file: string): string {
  const marker = file.search(/\/(features|system-tests|src)\//);
  if (marker >= 0) return file.slice(0, marker);
  const parts = file.split("/");
  if (["modules", "packages", "ports"].includes(parts[0] as string)) return parts.slice(0, 2).join("/");
  if (parts[0] === "adapters") return parts.slice(0, 3).join("/");
  return parts[0] as string;
}

/** A library is a package in packages/ without a bin: code that modules may depend on (ADR 0037, ADR 0039). */
export function isLibrary(repo: Repo, unit: string): boolean {
  const manifest = `${unit}/package.json`;
  if (!/^packages\/[^/]+$/.test(unit) || !repo.exists(manifest)) return false;
  return (JSON.parse(repo.read(manifest)) as { bin?: unknown }).bin === undefined;
}

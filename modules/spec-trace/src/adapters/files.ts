// The repository in the current folder: its files, without installed packages and hidden folders.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import picomatch from "picomatch";

export class Folder {
  readonly root: string;
  readonly files: string[];

  constructor(root: string) {
    this.root = root;
    this.files = walk(root)
      .map((file) => relative(root, file).split("\\").join("/"))
      .sort();
  }

  match(globs: string[]): string[] {
    const isMatch = picomatch(globs, { dot: true });
    return this.files.filter((file) => isMatch(file));
  }

  read(file: string): string {
    return readFileSync(join(this.root, file), "utf8");
  }

  /** The file's text, or undefined when it does not exist. */
  optional(file: string): string | undefined {
    return existsSync(join(this.root, file)) ? this.read(file) : undefined;
  }
}

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    if (entry.startsWith(".") || entry === "node_modules") return [];
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

// The files a command reads and writes: the inputs named on the command line, its output folder and its package.
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { UsageError } from "./errors.ts";

export interface Input {
  file: string;
  text: string;
}

/**
 * Each file named, and each file below each folder named whose name matches `pattern`, with its text. A folder's
 * files come sorted by path. A path that does not exist is a usage error.
 */
export function readInputs(paths: string[], pattern: RegExp): Input[] {
  return paths.flatMap((path) => {
    if (!existsSync(path)) throw new UsageError(`${path}: no such file or folder`);
    const files = statSync(path).isDirectory() ? walk(path).filter((file) => pattern.test(file)) : [path];
    return files.map((file) => ({ file, text: readFileSync(file, "utf8") }));
  });
}

/** Writes the text to the file, and creates its folder first. */
export function writeText(path: string, text: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
}

/** `out` when the user gave it, else `file` in the folder $OUTPUT, else `file` in the current folder. */
export function outputPath(file: string, out?: string, env: NodeJS.ProcessEnv = process.env): string {
  return out ?? (env.OUTPUT ? join(env.OUTPUT, file) : file);
}

/** The version in a package.json, for example `new URL("../package.json", import.meta.url)`. */
export function packageVersion(manifest: URL | string): string {
  return (JSON.parse(readFileSync(manifest, "utf8")) as { version: string }).version;
}

/** readdirSync lists the names of a folder sorted (libuv's scandir), so the files come sorted by path. */
function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

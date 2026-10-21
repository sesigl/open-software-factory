// Files: the input files and folders, and the report files.
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { check } from "../domain/errors.ts";

/** Each object of the files and folders named, with "<file>:<line>". A folder gives every .json and .jsonl file below it. */
export function readObjects(paths: string[]): { where: string; value: unknown }[] {
  check(paths.length, "name at least one file or folder to ingest");
  return paths.flatMap((path) => {
    check(existsSync(path), `${path}: no such file or folder`);
    const files = statSync(path).isDirectory() ? walk(path).filter((file) => /\.jsonl?$/.test(file)) : [path];
    return files.flatMap((file) => objectsOf(file, readFileSync(file, "utf8")));
  });
}

/** One JSON value (an object, or an array of objects) or JSON Lines. */
function objectsOf(file: string, text: string): { where: string; value: unknown }[] {
  try {
    const whole: unknown = JSON.parse(text);
    return (Array.isArray(whole) ? whole : [whole]).map((value) => ({ where: `${file}:1`, value }));
  } catch {
    return text.split("\n").flatMap((line, index) => {
      return line.trim() ? [{ where: `${file}:${index + 1}`, value: parseLine(line) }] : [];
    });
  }
}

/** A JSON line's value; a line that is not JSON gives undefined, which no record kind accepts. */
function parseLine(line: string): unknown {
  try {
    return JSON.parse(line);
  } catch {
    return undefined;
  }
}

export function writeText(path: string, text: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
}

function walk(dir: string): string[] {
  return readdirSync(dir)
    .sort()
    .flatMap((entry) => {
      const full = join(dir, entry);
      return statSync(full).isDirectory() ? walk(full) : [full];
    });
}

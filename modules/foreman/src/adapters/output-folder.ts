// The output folder: the module writes its results below $OUTPUT (src/config.schema.json).
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

/** Writes a file below $OUTPUT, or the current directory when OUTPUT is not set, and returns its path. */
export function writeOutput(file: string, content: string): string {
  const folder = resolve(process.env.OUTPUT ?? process.cwd());
  mkdirSync(folder, { recursive: true });
  const path = join(folder, file);
  writeFileSync(path, content);
  return path;
}

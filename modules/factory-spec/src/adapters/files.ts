// The factory folder (factory.yaml, prompts, skills, factory.lock) and the output folder ($OUTPUT).
import { createHash } from "node:crypto";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import type { Lock } from "../domain/mcp.ts";

export function readText(path: string): string {
  return readFileSync(path, "utf8");
}

export function exists(path: string): boolean {
  return existsSync(path);
}

/** The folder the module writes to: $OUTPUT, or the current folder. */
export function outputFolder(): string {
  return resolve(process.env.OUTPUT ?? ".");
}

export function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex").slice(0, 12);
}

export function readLock(dir: string): Lock {
  const path = join(dir, "factory.lock");
  return existsSync(path) ? (JSON.parse(readFileSync(path, "utf8")) as Lock) : { version: 1, mcp: {} };
}

export function writeLock(dir: string, lock: Lock): void {
  writeFileSync(join(dir, "factory.lock"), `${JSON.stringify(lock, null, 2)}\n`);
}

/** Writes each file below the output folder and returns the hash of each, by path. */
export function writeFiles(output: string, files: Record<string, string>): Record<string, string> {
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(output, path)), { recursive: true });
    writeFileSync(join(output, path), content);
  }
  return Object.fromEntries(Object.entries(files).map(([path, content]) => [path, sha256(content)]));
}

/** The hash of a file below the output folder, or "missing". */
export function hashOf(output: string, path: string): string {
  return existsSync(join(output, path)) ? sha256(readFileSync(join(output, path), "utf8")) : "missing";
}

/**
 * Makes the skill folder hold exactly one relative link per skill folder, named after it. Links of skills that are
 * no longer declared are removed; folders and files that are not links stay.
 */
export function linkSkills(folder: string, skills: string[]): void {
  mkdirSync(folder, { recursive: true });
  const names = skills.map((skill) => skill.split("/").filter(Boolean).pop() as string);
  for (const entry of readdirSync(folder)) {
    if (lstatSync(join(folder, entry)).isSymbolicLink() && !names.includes(entry)) rmSync(join(folder, entry));
  }
  skills.forEach((skill, index) => {
    const link = join(folder, names[index] as string);
    rmSync(link, { force: true });
    symlinkSync(relative(folder, skill), link);
  });
}

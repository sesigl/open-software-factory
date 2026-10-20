// The bundle folder: copies files into it, hashes them, reads and writes evidence.json.
import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative } from "node:path";
import type { EvidenceManifest } from "@opensoftware/contracts";

export const MANIFEST = "evidence.json";

/** Fails with the first file that does not exist. */
export function mustExist(files: string[]): void {
  const missing = files.find((file) => !existsSync(file));
  if (missing) throw new Error(`${missing} does not exist`);
}

/** Empties what an earlier bundle left in the folder, then copies each file to its path below it. */
export function writeFiles(folder: string, copies: { source: string; path: string }[]): void {
  for (const entry of [MANIFEST, "artifacts", "junit"]) rmSync(join(folder, entry), { recursive: true, force: true });
  mkdirSync(folder, { recursive: true });
  for (const copy of copies) {
    mkdirSync(dirname(join(folder, copy.path)), { recursive: true });
    copyFileSync(copy.source, join(folder, copy.path));
  }
}

/** The SHA-256 and size of a file below the folder, or undefined when it is missing. */
export function fingerprint(folder: string, path: string): { sha256: string; bytes: number } | undefined {
  const file = join(folder, path);
  if (!existsSync(file)) return undefined;
  return { sha256: createHash("sha256").update(readFileSync(file)).digest("hex"), bytes: statSync(file).size };
}

export function writeManifest(folder: string, manifest: EvidenceManifest): string {
  const file = join(folder, MANIFEST);
  writeFileSync(file, `${JSON.stringify(manifest, null, 2)}\n`);
  return file;
}

export function readManifest(folder: string): unknown {
  return JSON.parse(readFileSync(join(folder, MANIFEST), "utf8"));
}

/** Every file below the folder, as paths relative to it with forward slashes. */
export function listBundle(folder: string): string[] {
  const walk = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
      entry.isDirectory()
        ? walk(join(dir, entry.name))
        : [relative(folder, join(dir, entry.name)).replaceAll("\\", "/")],
    );
  return walk(folder).sort();
}

export function readBundleFile(folder: string, path: string): Buffer {
  return readFileSync(join(folder, path));
}

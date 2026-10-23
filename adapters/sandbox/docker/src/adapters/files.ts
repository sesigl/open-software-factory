// Files on the Docker client's side: a temporary folder for what `docker cp` copies.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

/** Writes the files below a new temporary folder, calls `use` with it and removes it afterwards. */
export async function withFolder<T>(files: Record<string, string>, use: (folder: string) => Promise<T>): Promise<T> {
  const folder = mkdtempSync(join(tmpdir(), "sandbox-docker-"));
  try {
    for (const [path, text] of Object.entries(files)) {
      mkdirSync(dirname(join(folder, path)), { recursive: true });
      writeFileSync(join(folder, path), text);
    }
    return await use(folder);
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
}

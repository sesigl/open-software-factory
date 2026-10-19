import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** A pinned binary: `.tools/bin/<name>` of this repository (from `make tools`), else the one on PATH. */
export function findTool(name: string): string | undefined {
  const pinned = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", ".tools", "bin", name);
  if (existsSync(pinned)) return pinned;
  const which = spawnSync("sh", ["-c", `command -v ${name}`], { encoding: "utf8" });
  return which.status === 0 ? which.stdout.trim() : undefined;
}

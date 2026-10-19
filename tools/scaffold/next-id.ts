// `make next-id MODULE=proof`: the next free scenario ID for a module. IDs are never reused, so the number
// follows the highest ID with that prefix anywhere in the repository's feature files.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const PREFIX_FILE = "docs/reference/scenario-prefixes.md";

export function nextId(root: string, args: string[]): number {
  const module = args[0];
  if (!module) return fail("Give a module: osf next-id <module>");
  const table = existsSync(join(root, PREFIX_FILE)) ? readFileSync(join(root, PREFIX_FILE), "utf8") : "";
  const prefix = table
    .split("\n")
    .map((row) => /^\|\s*([A-Z][A-Z0-9]*)\s*\|\s*([^|]+?)\s*\|\s*`([^`]+)`/.exec(row))
    .find(
      (match) => match && (match[2] === module || match[3]?.split("/").includes(module) || match[1] === module),
    )?.[1];
  if (!prefix) return fail(`No scenario prefix is registered for ${module} in ${PREFIX_FILE}`);

  const used = new RegExp(`SCN-${prefix}-(\\d{3})\\b`, "g");
  let highest = 0;
  for (const file of featureFiles(root)) {
    for (const match of readFileSync(file, "utf8").matchAll(used)) highest = Math.max(highest, Number(match[1]));
  }
  process.stdout.write(`SCN-${prefix}-${String(highest + 1).padStart(3, "0")}\n`);
  return 0;
}

function featureFiles(dir: string): string[] {
  return readdirSync(dir)
    .sort()
    .flatMap((entry) => {
      if (entry === ".git" || entry === "node_modules") return [];
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) return featureFiles(full);
      return entry.endsWith(".feature") ? [full] : [];
    });
}

function fail(message: string): number {
  process.stderr.write(`${message}\n`);
  return 1;
}

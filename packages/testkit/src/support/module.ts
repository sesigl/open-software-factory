// Where a module, its artifact and its documented settings are, read from its files.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";

export function findModuleRoot(testFile: string): string {
  for (let dir = dirname(testFile); dir !== dirname(dir); dir = dirname(dir)) {
    if (existsSync(join(dir, "features")) && existsSync(join(dir, "package.json"))) return dir;
  }
  throw new Error(`No module root (a folder with features/ and package.json) above ${testFile}`);
}

export function repoRoot(): string {
  for (let dir = process.cwd(); dir !== dirname(dir); dir = dirname(dir)) {
    if (existsSync(join(dir, "pnpm-workspace.yaml"))) return dir;
  }
  return process.cwd();
}

export function artifactOf(moduleRoot: string): string {
  const manifest = JSON.parse(readFileSync(join(moduleRoot, "package.json"), "utf8")) as {
    bin?: string | Record<string, string>;
  };
  const bin = typeof manifest.bin === "string" ? manifest.bin : Object.values(manifest.bin ?? {})[0];
  if (!bin) throw new Error(`${moduleRoot}/package.json declares no bin: the testkit has no artifact to start`);
  return join(moduleRoot, bin);
}

/** Environment variables named in backticks in the README's Configuration section. */
export function documentedEnv(moduleRoot: string): Set<string> {
  const readme = join(moduleRoot, "README.md");
  if (!existsSync(readme)) return new Set();
  const section =
    readFileSync(readme, "utf8")
      .split(/^## /m)
      .find((part) => part.startsWith("Configuration")) ?? "";
  return new Set([...section.matchAll(/`([A-Z][A-Z0-9_]*)`/g)].map((match) => match[1] as string));
}

export function scenarioStatus(moduleRoot: string, id: string): string | undefined {
  const tag = new RegExp(`@id=${id}\\b[^\\n]*@status=(\\w+)|@status=(\\w+)[^\\n]*@id=${id}\\b`);
  for (const file of listFiles(join(moduleRoot, "features"))) {
    if (!file.endsWith(".feature")) continue;
    const match = tag.exec(readFileSync(file, "utf8"));
    if (match) return match[1] ?? match[2];
  }
  return undefined;
}

export function listFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir).sort()) {
    if (entry === ".git" || entry === "node_modules") continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...listFiles(full));
    else out.push(full);
  }
  return out;
}

/** The Quick start section of the module's README: the arguments of its `npx` line and the file it promises. */
export function quickStart(moduleRoot: string): { args: string[]; output: string } {
  const readme = join(moduleRoot, "README.md");
  const section =
    (existsSync(readme) ? readFileSync(readme, "utf8") : "")
      .split(/^## /m)
      .find((part) => part.startsWith("Quick start")) ?? "";
  const command = /^\s*npx\s+\S+[ \t]*(.*)$/m.exec(section);
  const output = /`\$OUTPUT\/([^`]+)`/.exec(section);
  if (!command || !output) {
    throw new Error(`${readme} needs a Quick start section with an "npx <package> ..." line and a \`$OUTPUT/<file>\``);
  }
  const args = (command[1] ?? "").trim();
  return { args: args ? args.split(/\s+/) : [], output: output[1] as string };
}

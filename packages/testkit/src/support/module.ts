// Where a module, its artifact and its documented settings are, read from its files.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { documentedEnv, readmeSection } from "./readme.ts";

export function findModuleRoot(testFile: string): string {
  for (let dir = dirname(testFile); dir !== dirname(dir); dir = dirname(dir)) {
    const tests = existsSync(join(dir, "features")) || existsSync(join(dir, "system-tests"));
    if (tests && existsSync(join(dir, "package.json"))) return dir;
  }
  throw new Error(`No module root (a folder with package.json and features/ or system-tests/) above ${testFile}`);
}

export function repoRoot(): string {
  for (let dir = process.cwd(); dir !== dirname(dir); dir = dirname(dir)) {
    if (existsSync(join(dir, "pnpm-workspace.yaml"))) return dir;
  }
  return process.cwd();
}

/** The pnpm workspace that contains the folder, or undefined. */
export function workspaceOf(dir: string): string | undefined {
  for (let at = dir; at !== dirname(at); at = dirname(at)) {
    if (existsSync(join(at, "pnpm-workspace.yaml"))) return at;
  }
  return undefined;
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
export function moduleEnv(moduleRoot: string): Set<string> {
  const readme = join(moduleRoot, "README.md");
  if (!existsSync(readme)) return new Set();
  return documentedEnv(readFileSync(readme, "utf8"));
}

/**
 * The status of a scenario of the module, or of its port when the module is an adapter: the port's features are
 * in the folder `testkit conformance` names, or in `ports/<port>/features/` for `adapters/<port>/<adapter>/`.
 */
export function scenarioStatus(moduleRoot: string, id: string): string | undefined {
  const tag = new RegExp(`@id=${id}\\b[^\\n]*@status=(\\w+)|@status=(\\w+)[^\\n]*@id=${id}\\b`);
  for (const file of featureFiles(moduleRoot)) {
    const match = tag.exec(readFileSync(file, "utf8"));
    if (match) return match[1] ?? match[2];
  }
  return undefined;
}

/** The name of the scenario's tag `@shared=<name>` on the line of its `@id`, or undefined (ADR 0157). */
export function scenarioShared(moduleRoot: string, id: string): string | undefined {
  const line = new RegExp(`^[^\\n]*@id=${id}(?![0-9])[^\\n]*$`, "m");
  for (const file of featureFiles(moduleRoot)) {
    const tags = line.exec(readFileSync(file, "utf8"))?.[0];
    if (tags !== undefined) return /(?:^|\s)@shared=(\S+)/.exec(tags)?.[1];
  }
  return undefined;
}

/** One row of an Outline's Examples: the value of each column, by the column's name. */
export type Example<Column extends string = string> = Readonly<Record<Column, string>>;

/**
 * The rows of the Examples tables of the scenario, in the order of the feature file; undefined when the scenario is
 * no Scenario Outline. An Outline without a row fails: it would test nothing.
 */
export function scenarioExamples(moduleRoot: string, id: string): Example[] | undefined {
  const tag = new RegExp(`^\\s*@(\\S*\\s+@)*id=${id}(\\s|$)`);
  for (const file of featureFiles(moduleRoot)) {
    const lines = readFileSync(file, "utf8").split("\n");
    const start = lines.findIndex((line) => tag.test(line));
    if (start < 0) continue;
    const at = start + lines.slice(start).findIndex((line) => /^\s*Scenario( Outline| Template)?:/.test(line));
    if (!/^\s*Scenario (Outline|Template):/.test(lines[at] ?? "")) return undefined;
    const rows: Example[] = [];
    let header: string[] | undefined;
    for (const line of lines.slice(at + 1)) {
      const text = line.trim();
      if (/^(Scenario|Example:|Rule:|Background:)/.test(text) || /^@(\S*\s+@)*id=/.test(text)) break;
      if (/^(Examples|Scenarios):/.test(text)) header = undefined;
      else if (text.startsWith("|")) {
        const cells = tableCells(text);
        if (header)
          rows.push(Object.freeze(Object.fromEntries(header.map((name, index) => [name, cells[index] ?? ""]))));
        else header = cells;
      }
    }
    if (rows.length === 0) throw new Error(`${id} is a Scenario Outline without a row in its Examples (${file})`);
    return rows;
  }
  return undefined;
}

/** The cells of a Gherkin table row, with its escapes: `\|` is a bar, `\n` a new line and `\\` a backslash. */
function tableCells(row: string): string[] {
  const cells: string[] = [];
  let cell = "";
  for (let index = 1; index < row.length; index++) {
    const char = row[index];
    if (char === "\\") {
      const next = row[++index];
      cell += next === "n" ? "\n" : next === "|" || next === "\\" ? next : `\\${next}`;
    } else if (char === "|") {
      cells.push(cell.trim());
      cell = "";
    } else cell += char;
  }
  return cells;
}

/** The feature files of the module, then those of its port when the module is an adapter. */
function featureFiles(moduleRoot: string): string[] {
  const adapter = /(.*)\/adapters\/([^/]+)\/[^/]+$/.exec(moduleRoot);
  const folders = [
    join(moduleRoot, "features"),
    ...(process.env.OSF_TESTKIT_PORT_FEATURES ? [process.env.OSF_TESTKIT_PORT_FEATURES] : []),
    ...(adapter ? [join(adapter[1] as string, "ports", adapter[2] as string, "features")] : []),
  ];
  return folders.flatMap(listFiles).filter((file) => file.endsWith(".feature"));
}

export function listFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  // The entries' types come with the listing, so only a link needs a stat of its own.
  const entries = readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
    a.name < b.name ? -1 : a.name > b.name ? 1 : 0,
  );
  for (const entry of entries) {
    if (entry.name === ".git" || entry.name === "node_modules") continue;
    const full = join(dir, entry.name);
    const folder = entry.isSymbolicLink() ? statSync(full).isDirectory() : entry.isDirectory();
    if (folder) out.push(...listFiles(full));
    else out.push(full);
  }
  return out;
}

/** The Quick start section of the module's README: the arguments of its `npx` line and the file it promises. */
export function quickStart(moduleRoot: string): { args: string[]; output: string } {
  const readme = join(moduleRoot, "README.md");
  const section = readmeSection(readFileSync(readme, "utf8"), "Quick start");
  const command = /^\s*npx\s+\S+[ \t]*(.*)$/m.exec(section);
  const output = /`\$OUTPUT\/([^`]+)`/.exec(section);
  if (!command || !output) {
    throw new Error(`${readme} needs a Quick start section with an "npx <package> ..." line and a \`$OUTPUT/<file>\``);
  }
  const args = (command[1] ?? "").trim();
  return { args: args ? args.split(/\s+/) : [], output: output[1] as string };
}

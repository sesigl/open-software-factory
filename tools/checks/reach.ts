// REACH: a pull request may not add lines to a module's src/ or bin/ that no system test reaches. The testkit
// records the code each module process ran in reports/coverage/ (V8 coverage JSON); this check maps it to source
// lines with v8-to-istanbul, through source maps for built files, and compares it with the lines added since OSF_BASE.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { isAbsolute, join, relative } from "node:path";
import { Node, Project } from "ts-morph";
import v8ToIstanbul from "v8-to-istanbul";
import type { Context } from "./lib/context.ts";
import { addedLines, changedFiles } from "./lib/git.ts";
import { type Finding, isLibrary, type Repo } from "./lib/repo.ts";

const COVERAGE = "reports/coverage";
const SOURCE =
  /^(modules\/[^/]+|packages\/[^/]+|adapters\/[^/]+\/[^/]+)\/(src|bin)\/(?!.*__unit__\/).+(?<!\.d)\.(ts|js|mjs)$/;

type FunctionCoverage = Parameters<ReturnType<typeof v8ToIstanbul>["applyCoverage"]>[0][number];
interface Script {
  url: string;
  functions: FunctionCoverage[];
}
/** Per source file, per line: whether a system test ran it. Lines without a statement are absent. */
type Lines = Map<string, Map<number, boolean>>;

export async function reach(context: Context): Promise<Finding[]> {
  const { repo } = context;
  const base = context.base("REACH");
  const covered = await coveredLines(repo);
  if (!base) return [];

  const findings: Finding[] = [];
  const uncoveredModules = new Set<string>();
  // A library's tests call it in their own process, which records no coverage; MUTATION covers its lines (ADR 0039).
  const checked = (path: string): boolean =>
    SOURCE.test(path) && repo.exists(path) && !isLibrary(repo, (SOURCE.exec(path) as RegExpExecArray)[1] as string);
  for (const file of changedFiles(repo.root, base).filter(checked)) {
    const lines = covered.get(file);
    if (!lines) {
      const text = repo.read(file);
      const first = firstRuntimeLine(file, text);
      if (first === undefined) continue;
      const module = (SOURCE.exec(file) as RegExpExecArray)[1] as string;
      if (![...covered.keys()].some((path) => path.startsWith(`${module}/`))) {
        uncoveredModules.add(module);
        continue;
      }
      findings.push({ check: "REACH", file, line: first, message: "no system test loads this file" });
      continue;
    }
    const text = repo.read(file).split("\n");
    const code = (line: number): boolean => !/^\s*($|\/\/|\/\*|\*)/.test(text[line - 1] ?? "");
    const missed = addedLines(repo.root, base, file).filter((line) => lines.get(line) === false && code(line));
    for (const [from, to] of runs(missed)) {
      const message =
        from === to ? "no system test reaches this line" : `no system test reaches lines ${from} to ${to}`;
      findings.push({ check: "REACH", file, line: from, message });
    }
  }
  for (const module of uncoveredModules) {
    findings.push({
      check: "REACH",
      file: `${module}/package.json`,
      line: 1,
      message: `no coverage in ${COVERAGE}/ for this module: run its system tests first`,
    });
  }
  return findings;
}

/** Merges every coverage file: a line counts as reached when any process ran it. */
async function coveredLines(repo: Repo): Promise<Lines> {
  const dir = join(repo.root, COVERAGE);
  const lines: Lines = new Map();
  const seen = new Set<string>();
  for (const name of existsSync(dir)
    ? readdirSync(dir)
        .filter((entry) => entry.endsWith(".json"))
        .sort()
    : []) {
    const { root, result } = JSON.parse(readFileSync(join(dir, name), "utf8")) as { root?: string; result: Script[] };
    for (const script of result) {
      const local = root && script.url.startsWith(`${root}/`) ? script.url.slice(root.length + 1) : undefined;
      if (!local || local.includes("/node_modules/") || !repo.exists(local)) continue;
      // Many processes run the same code the same way; convert each distinct record once.
      const key = `${local}\n${JSON.stringify(script.functions)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const converter = v8ToIstanbul(join(repo.root, local));
      await converter.load();
      converter.applyCoverage(script.functions);
      for (const [path, data] of Object.entries(converter.toIstanbul())) {
        const file = (isAbsolute(path) ? relative(repo.root, path) : path).split("\\").join("/");
        const own = lines.get(file) ?? new Map<number, boolean>();
        for (const [id, location] of Object.entries(data.statementMap)) {
          const line = location.start.line;
          own.set(line, (own.get(line) ?? false) || (data.s[id] ?? 0) > 0);
        }
        lines.set(file, own);
      }
      converter.destroy();
    }
  }
  return lines;
}

/** The first line with code that runs, or undefined for a file of types only. */
function firstRuntimeLine(file: string, text: string): number | undefined {
  const source = new Project({ useInMemoryFileSystem: true }).createSourceFile(file, text);
  const runtime = source.getStatements().find((statement) => {
    if (Node.isInterfaceDeclaration(statement) || Node.isTypeAliasDeclaration(statement)) return false;
    if (Node.isImportDeclaration(statement)) return !statement.isTypeOnly();
    if (Node.isExportDeclaration(statement)) return !statement.isTypeOnly();
    return !(Node.isAmbientable(statement) && statement.hasDeclareKeyword());
  });
  return runtime?.getStartLineNumber();
}

/** Consecutive line numbers as [first, last] pairs. */
function runs(lines: number[]): [number, number][] {
  const out: [number, number][] = [];
  for (const line of [...lines].sort((a, b) => a - b)) {
    const last = out.at(-1);
    if (last && line === last[1] + 1) last[1] = line;
    else out.push([line, line]);
  }
  return out;
}

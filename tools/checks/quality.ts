// DUP and MUTATION: limits on duplicated code and on mutants that no system test notices (ADR 0036). Each unit
// declares its limits in its AGENTS.md under "Quality limits".
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, posix, relative } from "node:path";
import type { Context } from "./lib/context.ts";
import { addedLines, changedFiles } from "./lib/git.ts";
import { type Finding, lineOf, type Repo } from "./lib/repo.ts";

/** Folders whose packages hold source code: modules, packages and adapters, as for ARCH. */
const UNIT_MANIFESTS = ["modules/*/package.json", "packages/*/package.json", "adapters/*/*/package.json"];
/** Units whose system tests run the built artifact through the testkit, so Stryker can mutate them. */
const MUTATED = /^(modules\/[^/]+|adapters\/[^/]+\/[^/]+)$/;
const SOURCE = /^(src|bin)\/.+\.(ts|tsx|js|mjs)$/;
const TOOLS_SOURCE = /^tools\/(bin|checks|scaffold)\/.+\.ts$/;
const SKIPPED = /(^|\/)__unit__\/|\.d\.ts$/;

export const DUP_BASELINE = "docs/quality/duplication-baseline.json";
const DUP_LIMIT = /Duplication:\s*at most\s*(\d+(?:\.\d+)?)\s*%/;
const MUTATION_LIMIT = /Mutation score:\s*at least\s*(\d+(?:\.\d+)?)\s*%[^\n]*?(\d+(?:\.\d+)?)\s*%\s*in total/;

/** The units with source files, each with its source files, relative to the repository root. */
export function units(repo: Repo): Map<string, string[]> {
  const found = new Map<string, string[]>();
  const add = (unit: string, file: string): void => {
    if (!SKIPPED.test(file)) found.set(unit, [...(found.get(unit) ?? []), file]);
  };
  for (const manifest of repo.match(...UNIT_MANIFESTS)) {
    const root = posix.dirname(manifest);
    for (const file of repo.files()) {
      if (file.startsWith(`${root}/`) && SOURCE.test(file.slice(root.length + 1))) add(root, file);
    }
  }
  for (const file of repo.files()) if (TOOLS_SOURCE.test(file)) add("tools", file);
  return found;
}

/** The units that mutation testing covers: modules and adapters with source files. */
export function mutatedUnits(repo: Repo): Map<string, string[]> {
  return new Map([...units(repo)].filter(([unit]) => MUTATED.test(unit)));
}

/** Where `osf mutation` writes the Stryker report of a unit. */
export function mutationReport(unit: string): string {
  return `reports/mutation/${unit.replaceAll("/", "-")}.json`;
}

interface Limit {
  file: string;
  line: number;
  values: number[];
}

function limitOf(repo: Repo, unit: string, pattern: RegExp): Limit | undefined {
  const file = `${unit}/AGENTS.md`;
  const text = repo.exists(file) ? repo.read(file) : "";
  const match = pattern.exec(text);
  return match ? { file, line: lineOf(text, match[0]), values: match.slice(1).map(Number) } : undefined;
}

interface Clone {
  lines: number;
  first: { file: string; start: number; end: number };
  second: { file: string; start: number; end: number };
}

/** Clones of at least 50 tokens between the files, found by jscpd. */
function clones(repo: Repo, files: string[]): Clone[] {
  if (files.length === 0) return [];
  const require = createRequire(import.meta.url);
  const jscpd = join(posix.dirname(require.resolve("jscpd/package.json")), "run-jscpd.js");
  const out = mkdtempSync(join(tmpdir(), "osf-dup-"));
  try {
    const run = spawnSync(
      process.execPath,
      [jscpd, "--absolute", "--min-tokens", "50", "--reporters", "json,silent", "--output", out, ...files],
      { cwd: repo.root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
    );
    if (run.status !== 0) throw new Error(`jscpd failed: ${run.stderr || run.stdout}`);
    const report = JSON.parse(readFileSync(join(out, "jscpd-report.json"), "utf8")) as {
      duplicates: {
        lines: number;
        firstFile: { name: string; start: number; end: number };
        secondFile: { name: string; start: number; end: number };
      }[];
    };
    const side = (file: { name: string; start: number; end: number }) => ({
      file: relative(repo.root, file.name).split("\\").join("/"),
      start: file.start,
      end: file.end,
    });
    return report.duplicates.map((clone) => ({
      lines: clone.lines,
      first: side(clone.firstFile),
      second: side(clone.secondFile),
    }));
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
}

const pairKey = (a: string, b: string): string => [a, b].sort().join(" ");

/** `make new-module` copies the template, so a new module starts as a clone of it. */
const TEMPLATE = "modules/_template";

export function dup(context: Context): Finding[] {
  const { repo } = context;
  const all = units(repo);
  const unitOf = new Map([...all].flatMap(([unit, files]) => files.map((file) => [file, unit] as const)));
  const found = clones(repo, [...unitOf.keys()]);
  const findings: Finding[] = [];

  // Inside a unit: the share of its lines that are part of a clone stays under the unit's limit.
  for (const [unit, files] of all) {
    const limit = limitOf(repo, unit, DUP_LIMIT);
    if (!limit) {
      findings.push({
        check: "DUP",
        file: `${unit}/AGENTS.md`,
        line: 1,
        message: `no "Duplication: at most N%" limit for ${unit} under Quality limits`,
      });
      continue;
    }
    const local = found.filter(
      (clone) => unitOf.get(clone.first.file) === unit && unitOf.get(clone.second.file) === unit,
    );
    const cloned = new Set<string>();
    for (const clone of local) {
      for (const side of [clone.first, clone.second]) {
        for (let line = side.start; line <= side.end; line++) cloned.add(`${side.file}:${line}`);
      }
    }
    const total = files.reduce((sum, file) => sum + repo.read(file).split("\n").length, 0);
    const share = total === 0 ? 0 : (cloned.size / total) * 100;
    const [max = 0] = limit.values;
    if (share <= max) continue;
    findings.push({
      check: "DUP",
      file: limit.file,
      line: limit.line,
      message: `${round(share)}% of the lines of ${unit} are duplicated, the limit is ${max}%`,
    });
    for (const clone of local) findings.push(cloneFinding(clone, "extract the shared code into one function"));
  }

  // Across units: none, except the clones the baseline lists. A listed clone that is gone leaves the baseline.
  const baseline = readBaseline(repo);
  const seen = new Set<string>();
  for (const clone of found) {
    const first = unitOf.get(clone.first.file);
    const second = unitOf.get(clone.second.file);
    if (first === second || first === TEMPLATE || second === TEMPLATE) continue;
    const key = pairKey(clone.first.file, clone.second.file);
    seen.add(key);
    if (baseline.has(key)) continue;
    findings.push(
      cloneFinding(clone, "move the shared code into a package in packages/ or into contracts/ (ADR 0036)"),
    );
  }
  for (const [key, line] of baseline) {
    if (!seen.has(key)) {
      findings.push({
        check: "DUP",
        file: DUP_BASELINE,
        line,
        message: `the clone between ${key.replace(" ", " and ")} is gone: remove it from the baseline`,
      });
    }
  }
  return findings;
}

function cloneFinding(clone: Clone, fix: string): Finding {
  return {
    check: "DUP",
    file: clone.first.file,
    line: clone.first.start,
    message: `${clone.lines} lines duplicate ${clone.second.file}:${clone.second.start}: ${fix}`,
  };
}

/** The file pairs of the cross-unit clones that existed when DUP started, each with its line in the baseline. */
function readBaseline(repo: Repo): Map<string, number> {
  const pairs = new Map<string, number>();
  if (!repo.exists(DUP_BASELINE)) return pairs;
  const text = repo.read(DUP_BASELINE);
  const { clones: listed = [] } = JSON.parse(text) as { clones?: [string, string][] };
  for (const [a, b] of listed) pairs.set(pairKey(a, b), lineOf(text, JSON.stringify(b)));
  return pairs;
}

interface Mutant {
  mutatorName: string;
  replacement?: string;
  status: string;
  location: { start: { line: number } };
}

const DETECTED = new Set(["Killed", "Timeout"]);
const UNDETECTED = new Set(["Survived", "NoCoverage"]);

export function mutation(context: Context): Finding[] {
  const { repo } = context;
  const total = context.total;
  const base = total ? undefined : context.base("MUTATION");
  if (!total && !base) return [];
  const changed = base ? new Set(changedFiles(repo.root, base)) : new Set<string>();
  const findings: Finding[] = [];

  for (const [unit, files] of mutatedUnits(repo)) {
    const manifest = `${unit}/package.json`;
    const scripts = (JSON.parse(repo.read(manifest)) as { scripts?: Record<string, string> }).scripts ?? {};
    if (!scripts.mutation) {
      const text = repo.read(manifest);
      const at = lineOf(text, '"scripts"');
      findings.push({ check: "MUTATION", file: manifest, line: at, message: `has no "mutation" script (ADR 0036)` });
      continue;
    }
    const limit = limitOf(repo, unit, MUTATION_LIMIT);
    if (!limit) {
      findings.push({
        check: "MUTATION",
        file: `${unit}/AGENTS.md`,
        line: 1,
        message: `no "Mutation score: at least N% ..., M% in total" limit for ${unit} under Quality limits`,
      });
      continue;
    }

    // The lines that count: every line, or the lines of mutated source files that the change adds.
    const lines = new Map<string, Set<number>>();
    if (base) {
      for (const file of files) {
        if (!changed.has(file) || !file.endsWith(".ts")) continue;
        const added = addedLines(repo.root, base, file);
        if (added.length > 0) lines.set(file, new Set(added));
      }
      if (lines.size === 0) continue;
    }

    const report = mutationReport(unit);
    if (!repo.exists(report)) {
      findings.push({
        check: "MUTATION",
        file: manifest,
        line: 1,
        message: `no mutation report ${report}: run make mutation${total ? " ALL=1" : ""}`,
      });
      continue;
    }
    const json = JSON.parse(repo.read(report)) as { files?: Record<string, { mutants?: Mutant[] }> };
    const counted: { file: string; mutant: Mutant }[] = [];
    for (const [path, entry] of Object.entries(json.files ?? {})) {
      const file = `${unit}/${path.split("\\").join("/")}`;
      for (const mutant of entry.mutants ?? []) {
        const within = !base || lines.get(file)?.has(mutant.location.start.line);
        if (within && (DETECTED.has(mutant.status) || UNDETECTED.has(mutant.status))) counted.push({ file, mutant });
      }
    }
    if (counted.length === 0) continue;
    const detected = counted.filter(({ mutant }) => DETECTED.has(mutant.status)).length;
    const score = (detected / counted.length) * 100;
    const [changedLimit = 0, totalLimit = 0] = limit.values;
    const min = total ? totalLimit : changedLimit;
    if (score >= min) continue;
    findings.push({
      check: "MUTATION",
      file: limit.file,
      line: limit.line,
      message: `${round(score)}% of the mutants ${total ? "" : "in changed lines "}of ${unit} were detected, the limit is ${min}%`,
    });
    for (const { file, mutant } of counted) {
      if (DETECTED.has(mutant.status)) continue;
      const replacement = mutant.replacement === undefined ? "" : ` ${JSON.stringify(mutant.replacement)}`;
      findings.push({
        check: "MUTATION",
        file,
        line: mutant.location.start.line,
        message: `${mutant.status === "NoCoverage" ? "no test runs" : "no test notices"} the mutant ${mutant.mutatorName}${replacement}: add a scenario or an assertion that fails on it`,
      });
    }
  }
  return findings;
}

function round(value: number): string {
  return String(Math.round(value * 10) / 10);
}

// FLAKE and BUDGET: the test results. SPEC, TRACE, STEPS and PASS run in spec-trace (ADR 0031).
import type { Context } from "./lib/context.ts";
import { type Scenario, statusOf } from "./lib/features.ts";
import { readResults, type TestResult } from "./lib/junit.ts";
import { type Finding, lineOf, moduleRootOf } from "./lib/repo.ts";
import { shortName, workspace } from "./lib/workspace.ts";

function implementedResults(
  context: Context,
  check: string,
): { results: Map<string, TestResult[]>; findings: Finding[] } {
  const results = new Map<string, TestResult[]>();
  const all = readResults(context.repo);
  if (!all) {
    const findings = implemented(context).map((scenario) => ({
      check,
      file: scenario.file,
      line: scenario.line,
      message: `no JUnit results in ${process.env.OSF_JUNIT_DIR ?? "reports/junit"}: run make test first`,
    }));
    return { results, findings: findings.slice(0, 1) };
  }
  for (const result of all) {
    if (result.id) results.set(result.id, [...(results.get(result.id) ?? []), result]);
  }
  return { results, findings: [] };
}

function implemented(context: Context): Scenario[] {
  return context
    .features()
    .scenarios.filter((scenario) => statusOf(scenario) === "implemented" && scenario.ids.length === 1);
}

export function flake(context: Context): Finding[] {
  const { results, findings } = implementedResults(context, "FLAKE");
  if (findings.length > 0) return findings;
  for (const scenario of implemented(context)) {
    const id = scenario.ids[0] as string;
    const retries = Math.max(0, ...(results.get(id) ?? []).map((result) => result.retries));
    if (retries > 0) {
      findings.push({
        check: "FLAKE",
        file: scenario.file,
        line: scenario.line,
        message: `${id} passed only after ${retries} ${retries === 1 ? "retry" : "retries"}`,
      });
    }
  }
  return findings;
}

/** The phrase of a budget line, with its seconds. */
const BUDGET_LINE = /System tests:\s*(\d+(?:\.\d+)?)\s*seconds of wall time/;

/** A budget section names its time and at most what dominates it; its history stays in Git (ADR 0155). */
const BUDGET_LINES = 3;

export function budget(context: Context): Finding[] {
  const roots = new Set<string>();
  for (const result of readResults(context.repo) ?? []) {
    if (result.file.includes("/system-tests/")) roots.add(moduleRootOf(result.file));
  }
  const findings: Finding[] = untimed(context);
  for (const root of [...roots].sort()) {
    const file = `${root}/AGENTS.md`;
    const text = context.repo.exists(file) ? context.repo.read(file) : "";
    const match = BUDGET_LINE.exec(text);
    if (!match) {
      findings.push({
        check: "BUDGET",
        file,
        line: 1,
        message: `no "System tests: N seconds of wall time" budget for ${root}`,
      });
      continue;
    }
    const limit = Number(match[1]);
    // The budget is the wall time of the unit's test command, from its start to its end (ADR 0155).
    const seconds = wallTimeOf(context, root);
    if (seconds === undefined) {
      findings.push({
        check: "BUDGET",
        file,
        line: lineOf(text, match[0]),
        message: `no wall time of the run of the system tests of ${root} in reports/run-time/: run them with "testkit timed" and then "osf collect-reports"`,
      });
    } else if (seconds > limit) {
      findings.push({
        check: "BUDGET",
        file,
        line: lineOf(text, match[0]),
        message: `system tests of ${root} took ${round(seconds)} s of wall time, the budget is ${limit} s`,
      });
    }
  }
  return [...findings, ...longSections(context)];
}

/** The seconds that `testkit timed` measured around the run of the unit's system tests. */
function wallTimeOf(context: Context, root: string): number | undefined {
  const unit = workspace(context.repo).find((each) => each.dir === root);
  const file = unit && `reports/run-time/${shortName(unit.name)}.json`;
  if (!file || !context.repo.exists(file)) return undefined;
  const { seconds } = JSON.parse(context.repo.read(file)) as { seconds?: unknown };
  return typeof seconds === "number" && seconds >= 0 ? seconds : undefined;
}

/** Budget sections of more than three lines: a journal of measurements belongs in the commit message. */
function longSections(context: Context): Finding[] {
  return workspace(context.repo).flatMap((unit) => {
    const file = `${unit.dir}/AGENTS.md`;
    if (!context.repo.exists(file)) return [];
    const text = context.repo.read(file);
    const section = /^## Budget\n([\s\S]*?)(?=^## |(?![\s\S]))/m.exec(text);
    const lines = section?.[1]?.split("\n").filter((line) => line.trim() !== "").length ?? 0;
    if (lines <= BUDGET_LINES) return [];
    return [
      {
        check: "BUDGET",
        file,
        line: lineOf(text, "## Budget"),
        message: `the budget section has ${lines} lines, at most ${BUDGET_LINES}: the budget line and what dominates the time`,
      },
    ];
  });
}

/** Packages with system tests whose `test:system` does not run them with `testkit timed`. */
function untimed(context: Context): Finding[] {
  return workspace(context.repo).flatMap((unit) => {
    if (!context.repo.exists(`${unit.dir}/system-tests`)) return [];
    const file = `${unit.dir}/package.json`;
    const text = context.repo.read(file);
    const script = (JSON.parse(text) as { scripts?: Record<string, string> }).scripts?.["test:system"] ?? "";
    // The testkit runs its own bin; every other package runs the testkit's.
    if (/(^|&& )(testkit|node bin\/testkit\.ts) timed /.test(script)) return [];
    return [
      {
        check: "BUDGET",
        file,
        line: lineOf(text, '"test:system"'),
        message: `"test:system" does not run the tests with "testkit timed", so BUDGET has no wall time of their run`,
      },
    ];
  });
}

function round(value: number): string {
  return String(Math.round(value * 10) / 10);
}

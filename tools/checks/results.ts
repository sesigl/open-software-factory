// BUDGET: the wall time of the test runs. SPEC, TRACE, STEPS and PASS run in spec-trace (ADR 0031). FLAKE is gone:
// every package's vitest config sets `retry: 0`, which AFFECTED keeps true, so no test passes on a retry.
import type { Context } from "./lib/context.ts";
import { readResults } from "./lib/junit.ts";
import { type Finding, lineOf, moduleRootOf } from "./lib/repo.ts";
import { shortName, workspace } from "./lib/workspace.ts";

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

/** The seconds of the budget line in the unit's AGENTS.md, or undefined without one (osf suite-plan reads it too). */
export function budgetOf(repo: Context["repo"], root: string): number | undefined {
  const file = `${root}/AGENTS.md`;
  const match = repo.exists(file) ? BUDGET_LINE.exec(repo.read(file)) : null;
  return match ? Number(match[1]) : undefined;
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

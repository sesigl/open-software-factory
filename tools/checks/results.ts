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

export function budget(context: Context): Finding[] {
  const results = readResults(context.repo) ?? [];
  const seconds = new Map<string, number>();
  for (const result of results) {
    if (!result.file.includes("/system-tests/")) continue;
    const root = moduleRootOf(result.file);
    seconds.set(root, (seconds.get(root) ?? 0) + result.seconds);
  }
  const findings: Finding[] = untimed(context);
  for (const [root, spent] of [...seconds].sort()) {
    const file = `${root}/AGENTS.md`;
    const text = context.repo.exists(file) ? context.repo.read(file) : "";
    const match = /System tests:\s*(\d+(?:\.\d+)?)\s*seconds/.exec(text);
    if (!match) {
      findings.push({ check: "BUDGET", file, line: 1, message: `no "System tests: N seconds" budget for ${root}` });
      continue;
    }
    const limit = Number(match[1]);
    // A budget is a time on the reference runner: a slower runner of the same run gets more time (ADR 0103).
    const slowdown = slowdownOf(context, root);
    if (spent / slowdown > limit) {
      const on =
        slowdown === 1
          ? ""
          : ` on a runner that took ${slowdown} times the reference time, ${round(spent / slowdown)} s on the reference runner`;
      findings.push({
        check: "BUDGET",
        file,
        line: lineOf(text, match[0]),
        message: `system tests of ${root} took ${round(spent)} s${on}, the budget is ${limit} s`,
      });
    }
  }
  return findings;
}

/** The slowdown that `testkit timed` measured in the run of the unit's tests, or 1 without a measurement. */
function slowdownOf(context: Context, root: string): number {
  const unit = workspace(context.repo).find((each) => each.dir === root);
  const file = unit && `reports/speed/${shortName(unit.name)}.json`;
  if (!file || !context.repo.exists(file)) return 1;
  const { slowdown } = JSON.parse(context.repo.read(file)) as { slowdown?: unknown };
  return typeof slowdown === "number" && slowdown > 0 ? slowdown : 1;
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
        message: `"test:system" does not run the tests with "testkit timed", so BUDGET cannot take the runner's speed into account`,
      },
    ];
  });
}

function round(value: number): string {
  return String(Math.round(value * 10) / 10);
}

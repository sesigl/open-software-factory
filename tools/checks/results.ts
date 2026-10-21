// FLAKE and BUDGET: the test results. SPEC, TRACE, STEPS and PASS run in spec-trace (ADR 0031).
import type { Context } from "./lib/context.ts";
import { type Scenario, statusOf } from "./lib/features.ts";
import { readResults, type TestResult } from "./lib/junit.ts";
import { type Finding, lineOf, moduleRootOf } from "./lib/repo.ts";

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
  const findings: Finding[] = [];
  for (const [root, spent] of [...seconds].sort()) {
    const file = `${root}/AGENTS.md`;
    const text = context.repo.exists(file) ? context.repo.read(file) : "";
    const match = /System tests:\s*(\d+(?:\.\d+)?)\s*seconds/.exec(text);
    if (!match) {
      findings.push({ check: "BUDGET", file, line: 1, message: `no "System tests: N seconds" budget for ${root}` });
      continue;
    }
    const limit = Number(match[1]);
    if (spent > limit) {
      findings.push({
        check: "BUDGET",
        file,
        line: lineOf(text, match[0]),
        message: `system tests of ${root} took ${round(spent)} s, the budget is ${limit} s`,
      });
    }
  }
  return findings;
}

function round(value: number): string {
  return String(Math.round(value * 10) / 10);
}

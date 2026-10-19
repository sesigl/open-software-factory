// TRACE, STEPS, PASS, FLAKE and BUDGET: scenarios, their system tests and the test results.
import type { Context } from "./lib/context.ts";
import { byId, isConformance, type Scenario, type Step, statusOf } from "./lib/features.ts";
import { readResults, type TestResult } from "./lib/junit.ts";
import { type Finding, lineOf, moduleRootOf } from "./lib/repo.ts";
import type { TestScenario } from "./lib/tests.ts";

interface Located extends TestScenario {
  file: string;
}

function testScenarios(context: Context): Located[] {
  return context
    .tests()
    .filter((test) => test.isTest)
    .flatMap((test) => test.scenarios.map((scenario) => ({ ...scenario, file: test.file })));
}

export function trace(context: Context): Finding[] {
  const scenarios = byId(context.features().scenarios);
  const tests = testScenarios(context);
  const findings: Finding[] = [];
  const byScenario = new Map<string, Located[]>();

  for (const test of tests) {
    const at = (message: string): void => {
      findings.push({ check: "TRACE", file: test.file, line: test.line, message });
    };
    if (test.id === null) {
      at("the scenario ID must be a string literal");
      continue;
    }
    const scenario = scenarios.get(test.id);
    if (!scenario) {
      at(`${test.id} names no scenario`);
      continue;
    }
    const expected = expectedRoot(scenario, test.file);
    if (!test.file.startsWith(`${expected}/system-tests/`)) {
      at(`the test of ${test.id} must live in ${expected}/system-tests/`);
    }
    byScenario.set(test.id, [...(byScenario.get(test.id) ?? []), test]);
  }

  const adaptersOf = (port: string): string[] => [
    ...new Set(
      context.repo
        .match(`adapters/${port}/*/**`)
        .map((file) => file.split("/").slice(0, 3).join("/"))
        .filter((dir) => dir.split("/").length === 3),
    ),
  ];

  for (const [id, scenario] of scenarios) {
    const status = statusOf(scenario);
    const found = byScenario.get(id) ?? [];
    const at = (message: string): void => {
      findings.push({ check: "TRACE", file: scenario.file, line: scenario.line, message });
    };
    if (status === "deprecated" && found.length > 0) at(`${id} is deprecated but still has a system test`);
    if (status !== "implemented") continue;
    if (isConformance(scenario)) {
      const port = scenario.file.split("/")[1] as string;
      for (const adapter of adaptersOf(port)) {
        const count = found.filter((test) => test.file.startsWith(`${adapter}/`)).length;
        if (count !== 1) at(`${id} needs exactly one system test in ${adapter}/system-tests/, has ${count}`);
      }
    } else if (found.length === 0) {
      at(`${id} is implemented but has no system test`);
    } else if (found.length > 1) {
      at(`${id} has ${found.length} system tests: ${found.map((test) => `${test.file}:${test.line}`).join(", ")}`);
    }
  }
  return findings;
}

function expectedRoot(scenario: Scenario, testFile: string): string {
  if (isConformance(scenario)) {
    const port = scenario.file.split("/")[1];
    const adapter = testFile.split("/").slice(0, 3).join("/");
    return testFile.startsWith(`adapters/${port}/`) ? adapter : `adapters/${port}/<adapter>`;
  }
  return moduleRootOf(scenario.file);
}

export function steps(context: Context): Finding[] {
  const scenarios = byId(context.features().scenarios);
  const findings: Finding[] = [];
  for (const test of testScenarios(context)) {
    const scenario = test.id ? scenarios.get(test.id) : undefined;
    if (!scenario) continue; // TRACE reports it.
    const mismatch = compare(scenario, test);
    if (mismatch) findings.push({ check: "STEPS", file: test.file, ...mismatch });
  }
  return findings;
}

function compare(scenario: Scenario, test: Located): { line: number; message: string } | undefined {
  const where = `${scenario.file}:${scenario.line}`;
  for (let index = 0; index < Math.max(scenario.steps.length, test.steps.length); index++) {
    const expected = scenario.steps[index];
    const actual = test.steps[index];
    if (!actual) {
      return { line: test.line, message: `missing the step "${show(expected as Step)}" of ${where}` };
    }
    if (!expected) {
      return {
        line: actual.line,
        message: `${actual.keyword.toLowerCase()}("${actual.label}") has no step in ${where}`,
      };
    }
    if (actual.label === null) return { line: actual.line, message: "the step label must be a string literal" };
    if (actual.keyword !== expected.keyword || !matches(expected.text, actual.label)) {
      return {
        line: actual.line,
        message: `${actual.keyword.toLowerCase()}("${actual.label}") differs from the step "${show(expected)}" (${scenario.file}:${expected.line})`,
      };
    }
  }
  return undefined;
}

function show(step: Step): string {
  return `${step.keyword} ${step.text}`;
}

/** Word for word; an outline parameter `<name>` matches any value. */
function matches(step: string, label: string): boolean {
  const pattern = step
    .split(/(<[^<>]+>)/)
    .map((part) => (/^<[^<>]+>$/.test(part) ? ".+" : part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
    .join("");
  return new RegExp(`^${pattern}$`).test(label);
}

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

export function pass(context: Context): Finding[] {
  const { results, findings } = implementedResults(context, "PASS");
  if (findings.length > 0) return findings;
  for (const scenario of implemented(context)) {
    const id = scenario.ids[0] as string;
    const own = results.get(id) ?? [];
    const at = (message: string): void => {
      findings.push({ check: "PASS", file: scenario.file, line: scenario.line, message: `${id} ${message}` });
    };
    if (own.length === 0) at("did not run in this run");
    else if (own.some((result) => result.status === "failed")) at("failed");
    else if (own.some((result) => result.status === "skipped")) at("was skipped");
  }
  return findings;
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

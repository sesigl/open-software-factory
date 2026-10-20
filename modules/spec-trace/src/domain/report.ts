// The JSON report: one entry per scenario with its tests, its result and its evidence, and the totals.
import { type Finding, type Inputs, statusOf } from "./model.ts";
import { resultOf } from "./rules.ts";

export interface ReportScenario {
  id: string;
  name: string;
  file: string;
  line: number;
  status: string;
  /** Rows of the Examples tables; an outline counts once however many examples it has. */
  examples: number;
  tests: string[];
  /** null when the run had no JUnit reports. */
  result: "passed" | "failed" | "skipped" | "not run" | null;
  /** Artifacts of the scenario in the evidence bundles; null without --evidence. */
  evidence: number | null;
}

export interface Report {
  scenarios: ReportScenario[];
  totals: {
    scenarios: number;
    planned: number;
    implemented: number;
    deprecated: number;
    tested: number;
    passed: number;
  };
  findings: Finding[];
}

/** `evidence` maps a scenario ID to its artifact count, or is undefined without bundles. */
export function report(inputs: Inputs, findings: Finding[], evidence: Map<string, number> | undefined): Report {
  const scenarios = inputs.scenarios
    .filter((scenario) => scenario.ids.length === 1)
    .map((scenario): ReportScenario => {
      const id = scenario.ids[0] as string;
      return {
        id,
        name: scenario.name,
        file: scenario.file,
        line: scenario.line,
        status: statusOf(scenario) ?? "unknown",
        examples: scenario.examples,
        tests: inputs.tests.filter((test) => test.id === id).map((test) => `${test.file}:${test.line}`),
        result: inputs.results ? resultOf(id, inputs.results) : null,
        evidence: evidence ? (evidence.get(id) ?? 0) : null,
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id));
  const count = (status: string): number => scenarios.filter((scenario) => scenario.status === status).length;
  return {
    scenarios,
    totals: {
      scenarios: scenarios.length,
      planned: count("planned"),
      implemented: count("implemented"),
      deprecated: count("deprecated"),
      tested: scenarios.filter((scenario) => scenario.tests.length > 0).length,
      passed: scenarios.filter((scenario) => scenario.result === "passed").length,
    },
    findings,
  };
}

export function summary({ totals }: Report): string {
  return `${totals.scenarios} scenarios: ${totals.implemented} implemented, ${totals.planned} planned, ${totals.deprecated} deprecated; ${totals.tested} with a test, ${totals.passed} passed`;
}

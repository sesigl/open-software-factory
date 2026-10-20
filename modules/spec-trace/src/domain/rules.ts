// SPEC, TRACE, STEPS and PASS: each rule turns the inputs into findings, without I/O.
import {
  byId,
  type Finding,
  type Inputs,
  type Rule,
  type Scenario,
  STATUSES,
  type Step,
  statusOf,
  type Test,
} from "./model.ts";

export const CHECKS: Record<Rule, (inputs: Inputs) => Finding[]> = {
  SPEC: spec,
  TRACE: trace,
  STEPS: steps,
  PASS: pass,
};

function spec({ config, scenarios, errors }: Inputs): Finding[] {
  const findings: Finding[] = [...errors];
  const first = new Map<string, Scenario>();
  for (const scenario of scenarios) {
    const at = (message: string): void => {
      findings.push({ rule: "SPEC", file: scenario.file, line: scenario.line, message });
    };
    if (scenario.ids.length !== 1) at(`needs exactly one @id tag, has ${scenario.ids.length}`);
    if (scenario.statuses.length !== 1) at(`needs exactly one @status tag, has ${scenario.statuses.length}`);
    for (const status of scenario.statuses.filter((status) => !STATUSES.includes(status))) {
      at(`@status=${status} is not one of ${STATUSES.join(", ")}`);
    }
    for (const id of scenario.ids) {
      const match = config.id.exec(id);
      if (!match) {
        at(`ID ${id} does not match ${config.id.source}`);
        continue;
      }
      const prefix = config.prefixes?.get(match[1] as string);
      if (config.prefixes && !prefix) at(`prefix ${match[1]} is not registered in ${sourceFile(config.prefixes)}`);
      if (prefix && !scenario.file.startsWith(prefix.path)) {
        at(`prefix ${match[1]} belongs to ${prefix.path} (${prefix.source})`);
      }
      const earlier = first.get(id);
      if (earlier) at(`duplicate ID ${id}, first at ${earlier.file}:${earlier.line}`);
      else first.set(id, scenario);
    }
  }
  return findings;
}

function sourceFile(prefixes: Map<string, { source: string }>): string {
  return ([...prefixes.values()][0]?.source ?? "the prefix table").replace(/:\d+$/, "");
}

function trace(inputs: Inputs): Finding[] {
  const { config, tests } = inputs;
  const scenarios = byId(inputs.scenarios);
  const findings: Finding[] = [];
  const byScenario = new Map<string, Test[]>();

  for (const test of tests) {
    const at = (message: string): void => {
      findings.push({ rule: "TRACE", file: test.file, line: test.line, message });
    };
    const scenario = test.id === null ? undefined : scenarios.get(test.id);
    if (test.id === null) at("the scenario ID must be a string literal");
    else if (!scenario) at(`${test.id} names no scenario`);
    if (!scenario || test.id === null) continue;
    const home = homeOf(inputs, scenario, test.file);
    if (home && !test.file.startsWith(home)) at(`the test of ${test.id} must live in ${home}`);
    byScenario.set(test.id, [...(byScenario.get(test.id) ?? []), test]);
  }

  for (const [id, scenario] of scenarios) {
    const status = statusOf(scenario);
    const found = byScenario.get(id) ?? [];
    const at = (message: string): void => {
      findings.push({ rule: "TRACE", file: scenario.file, line: scenario.line, message });
    };
    if (status === "deprecated" && found.length > 0) at(`${id} is deprecated but still has a system test`);
    if (status !== "implemented") continue;
    const adapters =
      config.conformance && scenario.tags.includes(config.conformance.tag) && adaptersOf(inputs, scenario);
    if (adapters) {
      for (const adapter of adapters) {
        const home = `${adapter}${config.testFolder ? `${config.testFolder}/` : ""}`;
        const count = found.filter((test) => test.file.startsWith(home)).length;
        if (count !== 1) at(`${id} needs exactly one system test in ${home}, has ${count}`);
      }
    } else if (found.length === 0) {
      at(`${id} is implemented but has no system test`);
    } else if (found.length > 1) {
      at(`${id} has ${found.length} system tests: ${found.map((test) => `${test.file}:${test.line}`).join(", ")}`);
    }
  }
  return findings;
}

/** The folder the test of a scenario must be in, or undefined when the configuration names none. */
function homeOf(inputs: Inputs, scenario: Scenario, testFile: string): string | undefined {
  const { config } = inputs;
  const folder = config.testFolder ? `${config.testFolder}/` : "";
  const adapters = config.conformance && scenario.tags.includes(config.conformance.tag) && adaptersOf(inputs, scenario);
  if (adapters) {
    const own = adapters.find((adapter) => testFile.startsWith(adapter));
    return own
      ? `${own}${folder}`
      : `${template(config.conformance?.adapters ?? "", portOf(inputs, scenario))}${folder}`;
  }
  const root = /^(.*\/)?features\//.exec(scenario.file);
  if (!config.testFolder || !root) return undefined;
  return `${root[1] ?? ""}${folder}`;
}

function portOf({ config }: Inputs, scenario: Scenario): string | undefined {
  const pattern = new RegExp(`^${escapeRegExp(config.conformance?.ports ?? "").replace("\\{port\\}", "([^/]+)")}`);
  return pattern.exec(scenario.file)?.[1];
}

/** The adapter folders of the scenario's port, or undefined when the scenario is not in a port. */
function adaptersOf(inputs: Inputs, scenario: Scenario): string[] | undefined {
  const port = portOf(inputs, scenario);
  if (!port) return undefined;
  const folder = escapeRegExp(template(inputs.config.conformance?.adapters ?? "", port)).replace(
    "\\{adapter\\}",
    "[^/]+",
  );
  const pattern = new RegExp(`^${folder}`);
  return [...new Set(inputs.files.map((file) => pattern.exec(file)?.[0]).filter((dir) => dir !== undefined))].sort();
}

function template(text: string, port: string | undefined): string {
  return text.replace("{port}", port ?? "<port>").replace(/\/?$/, "/");
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function steps(inputs: Inputs): Finding[] {
  const scenarios = byId(inputs.scenarios);
  const findings: Finding[] = [];
  for (const test of inputs.tests) {
    const scenario = test.id ? scenarios.get(test.id) : undefined;
    const mismatch = scenario && compare(scenario, test);
    if (mismatch) findings.push({ rule: "STEPS", file: test.file, ...mismatch });
  }
  return findings;
}

function compare(scenario: Scenario, test: Test): { line: number; message: string } | undefined {
  const where = `${scenario.file}:${scenario.line}`;
  for (let index = 0; index < Math.max(scenario.steps.length, test.steps.length); index++) {
    const expected = scenario.steps[index];
    const actual = test.steps[index];
    if (!actual) return { line: test.line, message: `missing the step "${show(expected as Step)}" of ${where}` };
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
    .map((part) => (/^<[^<>]+>$/.test(part) ? ".+" : escapeRegExp(part)))
    .join("");
  return new RegExp(`^${pattern}$`).test(label);
}

function pass({ config, scenarios, results }: Inputs): Finding[] {
  const implemented = scenarios.filter((scenario) => statusOf(scenario) === "implemented" && scenario.ids.length === 1);
  const [first] = implemented;
  if (!results) {
    if (!first) return [];
    const message = `no JUnit results in ${config.junit}: run the tests first`;
    return [{ rule: "PASS", file: first.file, line: first.line, message }];
  }
  const findings: Finding[] = [];
  for (const scenario of implemented) {
    const id = scenario.ids[0] as string;
    const result = resultOf(id, results);
    const message = result === "not run" ? "did not run in this run" : result === "skipped" ? "was skipped" : result;
    if (result !== "passed")
      findings.push({ rule: "PASS", file: scenario.file, line: scenario.line, message: `${id} ${message}` });
  }
  return findings;
}

/** Every result of the scenario counts: one example of an outline that failed fails the scenario. */
export function resultOf(id: string, results: Inputs["results"] & {}): "passed" | "failed" | "skipped" | "not run" {
  const own = results.filter((result) => result.id === id);
  if (own.length === 0) return "not run";
  if (own.some((result) => result.status === "failed")) return "failed";
  return own.some((result) => result.status === "skipped") ? "skipped" : "passed";
}

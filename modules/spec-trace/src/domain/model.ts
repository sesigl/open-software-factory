// The shapes the rules work on: scenarios from feature files, tests from test files, results from JUnit reports.

export type Keyword = "Given" | "When" | "Then";
export type Rule = "SPEC" | "TRACE" | "STEPS" | "PASS";
export const RULES: Rule[] = ["SPEC", "TRACE", "STEPS", "PASS"];
export const STATUSES = ["planned", "implemented", "deprecated"];

export interface Step {
  /** `And`, `But` and `*` take the keyword of the step before them. */
  keyword: Keyword;
  text: string;
  line: number;
}

export interface Scenario {
  file: string;
  line: number;
  name: string;
  ids: string[];
  statuses: string[];
  /** Feature, rule and scenario tags. */
  tags: string[];
  /** Background steps first. */
  steps: Step[];
  /** The rows of all Examples tables; 0 for a plain scenario. */
  examples: number;
}

export interface TestStep {
  keyword: Keyword;
  /** The label when it is a string literal, otherwise null. */
  label: string | null;
  line: number;
}

export interface Test {
  file: string;
  line: number;
  /** The first argument when it is a string literal, otherwise null. */
  id: string | null;
  steps: TestStep[];
}

export interface Result {
  id: string | undefined;
  status: "passed" | "failed" | "skipped";
}

export interface Finding {
  rule: Rule;
  file: string;
  line: number;
  message: string;
}

export interface Prefix {
  /** The folder whose feature files may use the prefix. */
  path: string;
  /** Where the prefix is registered, for the message. */
  source: string;
}

export interface Conformance {
  tag: string;
  /** Feature folder of a port, with `{port}`. */
  ports: string;
  /** Folder of an adapter, with `{port}` and `{adapter}`. */
  adapters: string;
}

export interface Config {
  features: string[];
  tests: string[];
  junit: string;
  id: RegExp;
  function: string;
  prefixes: Map<string, Prefix> | undefined;
  /** The test of a scenario in `<root>/features/` lives in `<root>/<testFolder>/`. */
  testFolder: string | undefined;
  conformance: Conformance | undefined;
}

/** Everything the rules read. `results` is undefined when there are no JUnit reports. */
export interface Inputs {
  config: Config;
  files: string[];
  scenarios: Scenario[];
  errors: Finding[];
  tests: Test[];
  results: Result[] | undefined;
}

/** Scenarios by their single ID; scenarios without exactly one ID are left out (SPEC reports them). */
export function byId(scenarios: Scenario[]): Map<string, Scenario> {
  const map = new Map<string, Scenario>();
  for (const scenario of scenarios) {
    const [id] = scenario.ids;
    if (scenario.ids.length === 1 && id && !map.has(id)) map.set(id, scenario);
  }
  return map;
}

export function statusOf(scenario: Scenario): string | undefined {
  return scenario.statuses.length === 1 ? scenario.statuses[0] : undefined;
}

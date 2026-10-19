import { AstBuilder, GherkinClassicTokenMatcher, Parser } from "@cucumber/gherkin";
import { IdGenerator } from "@cucumber/messages";
import type { Finding, Repo } from "./repo.ts";

/** Where scenarios live. `docs/vision/` is source material and is not checked. */
export const FEATURE_GLOBS = [
  "modules/*/features/**/*.feature",
  "ports/*/features/**/*.feature",
  "packages/*/features/**/*.feature",
  "contracts/features/**/*.feature",
  "tools/features/**/*.feature",
  "deploy/features/**/*.feature",
  "e2e/features/**/*.feature",
];

export const ID_PATTERN = /^SCN-([A-Z][A-Z0-9]*)-\d{3}$/;
export const STATUSES = ["planned", "implemented", "deprecated"];

export interface Step {
  /** Given, When or Then; `And`, `But` and `*` take the keyword of the step before them. */
  keyword: "Given" | "When" | "Then";
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
  steps: Step[];
}

export interface ParsedFeatures {
  scenarios: Scenario[];
  errors: Finding[];
}

export function parseFeature(file: string, text: string): ParsedFeatures {
  const parser = new Parser(new AstBuilder(IdGenerator.incrementing()), new GherkinClassicTokenMatcher());
  let document: ReturnType<typeof parser.parse>;
  try {
    document = parser.parse(text);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const line = Number(/\((\d+):\d+\)/.exec(message)?.[1] ?? 1);
    return { scenarios: [], errors: [{ check: "SPEC", file, line, message: `Gherkin does not parse: ${message}` }] };
  }
  const feature = document.feature;
  if (!feature) return { scenarios: [], errors: [] };

  const scenarios: Scenario[] = [];
  type Children = typeof feature.children;
  const visit = (children: Children, inherited: string[], background: Step[]): void => {
    let shared = background;
    for (const child of children) {
      if (child.background) shared = [...shared, ...toSteps(child.background.steps)];
      if (child.rule) {
        const tags = [...inherited, ...child.rule.tags.map((tag) => tag.name)];
        visit(child.rule.children as Children, tags, shared);
      }
      if (!child.scenario) continue;
      const own = child.scenario.tags.map((tag) => tag.name);
      scenarios.push({
        file,
        line: child.scenario.location.line,
        name: child.scenario.name,
        ids: tagValues(own, "id"),
        statuses: tagValues(own, "status"),
        tags: [...inherited, ...own],
        steps: [...shared, ...toSteps(child.scenario.steps)],
      });
    }
  };
  visit(
    feature.children,
    feature.tags.map((tag) => tag.name),
    [],
  );
  return { scenarios, errors: [] };
}

export function loadScenarios(repo: Repo): ParsedFeatures {
  const result: ParsedFeatures = { scenarios: [], errors: [] };
  for (const file of repo.match(...FEATURE_GLOBS)) {
    const parsed = parseFeature(file, repo.read(file));
    result.scenarios.push(...parsed.scenarios);
    result.errors.push(...parsed.errors);
  }
  return result;
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

export function isConformance(scenario: Scenario): boolean {
  return scenario.tags.includes("@conformance");
}

export function tagValues(tags: string[], key: string): string[] {
  return tags.filter((tag) => tag.startsWith(`@${key}=`)).map((tag) => tag.slice(key.length + 2));
}

function toSteps(steps: readonly { keyword: string; text: string; location: { line: number } }[]): Step[] {
  let previous: Step["keyword"] = "Given";
  return steps.map((step) => {
    const word = step.keyword.trim();
    const keyword = word === "Given" || word === "When" || word === "Then" ? word : previous;
    previous = keyword;
    return { keyword, text: step.text, line: step.location.line };
  });
}

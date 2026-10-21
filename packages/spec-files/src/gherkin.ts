// Feature files: the scenarios with their tags and steps, parsed with the official Gherkin parser.
import { AstBuilder, GherkinClassicTokenMatcher, Parser } from "@cucumber/gherkin";
import { IdGenerator } from "@cucumber/messages";

export type Keyword = "Given" | "When" | "Then";

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
  /** The values of the `@id=` tags of the scenario. */
  ids: string[];
  /** The values of the `@status=` tags of the scenario. */
  statuses: string[];
  /** Feature, rule and scenario tags. */
  tags: string[];
  /** Background steps first. */
  steps: Step[];
  /** The rows of all Examples tables; 0 for a plain scenario. */
  examples: number;
}

/** A feature file that does not parse, at the line the parser names. */
export interface ParseError {
  file: string;
  line: number;
  message: string;
}

export function parseFeature(file: string, text: string): { scenarios: Scenario[]; errors: ParseError[] } {
  const parser = new Parser(new AstBuilder(IdGenerator.incrementing()), new GherkinClassicTokenMatcher());
  let document: ReturnType<typeof parser.parse>;
  try {
    document = parser.parse(text);
  } catch (error) {
    const message = (error as Error).message;
    const line = Number(/\((\d+):\d+\)/.exec(message)?.[1] ?? 1);
    return { scenarios: [], errors: [{ file, line, message: `Gherkin does not parse: ${message}` }] };
  }
  const feature = document.feature;
  const scenarios: Scenario[] = [];
  type Children = NonNullable<typeof feature>["children"];
  const visit = (children: Children, inherited: string[], background: Step[]): void => {
    let shared = background;
    for (const child of children) {
      if (child.background) shared = [...shared, ...toSteps(child.background.steps)];
      if (child.rule) visit(child.rule.children as Children, [...inherited, ...names(child.rule.tags)], shared);
      if (!child.scenario) continue;
      const own = names(child.scenario.tags);
      scenarios.push({
        file,
        line: child.scenario.location.line,
        name: child.scenario.name,
        ids: tagValues(own, "id"),
        statuses: tagValues(own, "status"),
        tags: [...inherited, ...own],
        steps: [...shared, ...toSteps(child.scenario.steps)],
        examples: child.scenario.examples.reduce((sum, table) => sum + table.tableBody.length, 0),
      });
    }
  };
  if (feature) visit(feature.children, names(feature.tags), []);
  return { scenarios, errors: [] };
}

/** The values of the tags `@<key>=<value>`. */
export function tagValues(tags: string[], key: string): string[] {
  return tags.filter((tag) => tag.startsWith(`@${key}=`)).map((tag) => tag.slice(key.length + 2));
}

/** The status of a scenario with exactly one `@status=` tag. */
export function statusOf(scenario: Scenario): string | undefined {
  return scenario.statuses.length === 1 ? scenario.statuses[0] : undefined;
}

function names(tags: readonly { name: string }[]): string[] {
  return tags.map((tag) => tag.name);
}

// The parser classifies each step in every language; `And`, `But` and `*` take the keyword before them.
const KEYWORDS: Record<string, Keyword> = { Context: "Given", Action: "When", Outcome: "Then" };

function toSteps(steps: readonly { keywordType?: string; text: string; location: { line: number } }[]): Step[] {
  let previous: Keyword = "Given";
  return steps.map((step) => {
    const keyword = KEYWORDS[String(step.keywordType)] ?? previous;
    previous = keyword;
    return { keyword, text: step.text, line: step.location.line };
  });
}

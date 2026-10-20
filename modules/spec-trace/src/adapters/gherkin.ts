// Feature files, parsed with the official Gherkin parser.
import { AstBuilder, GherkinClassicTokenMatcher, Parser } from "@cucumber/gherkin";
import { IdGenerator } from "@cucumber/messages";
import type { Finding, Keyword, Scenario, Step } from "../domain/model.ts";

export function parseFeature(file: string, text: string): { scenarios: Scenario[]; errors: Finding[] } {
  const parser = new Parser(new AstBuilder(IdGenerator.incrementing()), new GherkinClassicTokenMatcher());
  let document: ReturnType<typeof parser.parse>;
  try {
    document = parser.parse(text);
  } catch (error) {
    const message = (error as Error).message;
    const line = Number(/\((\d+):\d+\)/.exec(message)?.[1] ?? 1);
    return { scenarios: [], errors: [{ rule: "SPEC", file, line, message: `Gherkin does not parse: ${message}` }] };
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
        ids: values(own, "id"),
        statuses: values(own, "status"),
        tags: [...inherited, ...own],
        steps: [...shared, ...toSteps(child.scenario.steps)],
        examples: child.scenario.examples.reduce((sum, table) => sum + table.tableBody.length, 0),
      });
    }
  };
  if (feature) visit(feature.children, names(feature.tags), []);
  return { scenarios, errors: [] };
}

function names(tags: readonly { name: string }[]): string[] {
  return tags.map((tag) => tag.name);
}

function values(tags: string[], key: string): string[] {
  return tags.filter((tag) => tag.startsWith(`@${key}=`)).map((tag) => tag.slice(key.length + 2));
}

function toSteps(steps: readonly { keyword: string; text: string; location: { line: number } }[]): Step[] {
  let previous: Keyword = "Given";
  return steps.map((step) => {
    const word = step.keyword.trim();
    const keyword = word === "Given" || word === "When" || word === "Then" ? word : previous;
    previous = keyword;
    return { keyword, text: step.text, line: step.location.line };
  });
}

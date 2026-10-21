// Feature files, parsed by @opensoftware/spec-files with the official Gherkin parser.
import { parseFeature as parse } from "@opensoftware/spec-files";
import type { Finding, Scenario } from "../domain/model.ts";

export function parseFeature(file: string, text: string): { scenarios: Scenario[]; errors: Finding[] } {
  const { scenarios, errors } = parse(file, text);
  return { scenarios, errors: errors.map((error) => ({ rule: "SPEC", ...error })) };
}

import { parseFeature, type Scenario } from "@opensoftware/spec-files";
import type { Finding, Repo } from "./repo.ts";

export { type Scenario, statusOf } from "@opensoftware/spec-files";

/** Where scenarios live. `docs/vision/` is source material and is not checked. */
const FEATURE_GLOBS = [
  "modules/*/features/**/*.feature",
  "ports/*/features/**/*.feature",
  "packages/*/features/**/*.feature",
  "contracts/features/**/*.feature",
  "tools/features/**/*.feature",
  "deploy/features/**/*.feature",
  "e2e/features/**/*.feature",
];

export interface ParsedFeatures {
  scenarios: Scenario[];
  errors: Finding[];
}

/** The scenarios of every feature file; a file that does not parse is a SPEC finding. */
export function loadScenarios(repo: Repo): ParsedFeatures {
  const result: ParsedFeatures = { scenarios: [], errors: [] };
  for (const file of repo.match(...FEATURE_GLOBS)) {
    const parsed = parseFeature(file, repo.read(file));
    result.scenarios.push(...parsed.scenarios);
    result.errors.push(...parsed.errors.map((error) => ({ check: "SPEC", ...error })));
  }
  return result;
}

// Text builders for the vision feature, the module scenarios that realize it and TODO.md.
import { DEMO_PACKAGE, DEMO_PREFIXES } from "./repo.ts";

export const VISION = "docs/vision/software-factory.feature";

/** Two vision scenarios; the tag line of the first is line 5, of the second line 9. */
export function visionFeature(first: string, second: string): string {
  return [
    "# The vision of the demo.",
    "@context=demo",
    "Feature: Demo",
    "",
    `  @scenario_id=SCN-FACTORY-DEMO-001 @status=${first}`,
    "  Scenario: one",
    "    Given a demo",
    "",
    `  @scenario_id=SCN-FACTORY-DEMO-002 @status=${second}`,
    "  Scenario: two",
    "    Given a demo",
    "",
  ].join("\n");
}

/** The module "demo" with the scenarios SCN-DEMO-001 and SCN-DEMO-002, each realizing the given vision scenario. */
export function realizingModule(first: string, second: string, realizes: string): Record<string, string> {
  const scenario = (id: string, status: string): string =>
    [`  @id=${id} @status=${status} @realizes=${realizes}`, `  Scenario: ${id}`, "    Given a demo", ""].join("\n");
  return {
    "docs/reference/scenario-prefixes.md": DEMO_PREFIXES,
    "modules/demo/package.json": DEMO_PACKAGE,
    "modules/demo/features/a.feature": [
      "@module=demo",
      "Feature: Demo",
      "",
      scenario("SCN-DEMO-001", first),
      scenario("SCN-DEMO-002", second),
    ].join("\n"),
  };
}

export const TODO = [
  "# Plan",
  "",
  "### [ ] T-01 · done but open",
  "",
  "- **Slices:**",
  "  - [x] One.",
  "  - [x] Two.",
  "",
  "### [ ] T-02 · in progress",
  "",
  "- **Slices:**",
  "  - [x] One.",
  "  - [ ] Two.",
  "",
  "### [ ] T-03 · not cut yet",
  "",
  "- **Done when:** later.",
  "",
].join("\n");

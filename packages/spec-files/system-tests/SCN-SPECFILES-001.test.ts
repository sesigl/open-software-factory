import { parseFeature, type Scenario } from "@opensoftware/spec-files";
import { scenario } from "@opensoftware/testkit";

scenario("SCN-SPECFILES-001", async ({ given, when, then }) => {
  let text: string;
  await given(
    'the feature file "a.feature" with the feature tag "@module=demo", a Background step "* a repository", and in a Rule tagged "@slow" the scenario "Steps" tagged "@id=SCN-DEMO-001 @status=implemented" with the steps "When the user runs it", "And it ends", "Then it passes" and "Given the next run"',
    async () => {
      text = [
        "@module=demo",
        "Feature: Demo",
        "  Background:",
        "    * a repository",
        "",
        "  @slow",
        "  Rule: Slow ones",
        "    @id=SCN-DEMO-001 @status=implemented",
        "    Scenario: Steps",
        "      When the user runs it",
        "      And it ends",
        "      Then it passes",
        "      Given the next run",
        "",
      ].join("\n");
    },
  );

  let scenarios: Scenario[];
  await when("the module parses the feature file", async () => {
    ({ scenarios } = parseFeature("a.feature", text));
  });

  await then(
    'it gets one scenario "Steps" in "a.feature" with the ID "SCN-DEMO-001" and the status "implemented"',
    async () => {
      expect(scenarios.map(({ name, file, line, ids, statuses }) => ({ name, file, line, ids, statuses }))).toEqual([
        { name: "Steps", file: "a.feature", line: 9, ids: ["SCN-DEMO-001"], statuses: ["implemented"] },
      ]);
    },
  );

  await then('its tags are "@module=demo", "@slow", "@id=SCN-DEMO-001" and "@status=implemented"', async () => {
    expect(scenarios[0]?.tags).toEqual(["@module=demo", "@slow", "@id=SCN-DEMO-001", "@status=implemented"]);
  });

  await then(
    'its steps are "Given a repository", "When the user runs it", "When it ends", "Then it passes" and "Given the next run", with their lines',
    async () => {
      expect(scenarios[0]?.steps).toEqual([
        { keyword: "Given", text: "a repository", line: 4 },
        { keyword: "When", text: "the user runs it", line: 10 },
        { keyword: "When", text: "it ends", line: 11 },
        { keyword: "Then", text: "it passes", line: 12 },
        { keyword: "Given", text: "the next run", line: 13 },
      ]);
    },
  );
});

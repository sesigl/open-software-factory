import { parseFeature, type Scenario } from "@opensoftware/spec-files";
import { scenario } from "@opensoftware/testkit";

scenario("SCN-SPECFILES-002", async ({ given, when, then }) => {
  let text: string;
  await given(
    'the feature file "a.feature" with a Scenario Outline whose two Examples tables have 2 and 3 rows',
    async () => {
      text = [
        "Feature: Demo",
        "  Scenario Outline: Add <a>",
        "    When the user adds <a>",
        "    Examples:",
        "      | a |",
        "      | 1 |",
        "      | 2 |",
        "    Examples:",
        "      | a |",
        "      | 3 |",
        "      | 4 |",
        "      | 5 |",
        "",
      ].join("\n");
    },
  );

  let scenarios: Scenario[];
  await when("the module parses the feature file", async () => {
    ({ scenarios } = parseFeature("a.feature", text));
  });

  await then("the scenario has 5 examples", async () => {
    expect(scenarios.map((one) => one.examples)).toEqual([5]);
  });
});

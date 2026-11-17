import { parseFeature, type Scenario } from "@opensoftware/spec-files";
import { scenario } from "@opensoftware/testkit";

scenario("SCN-SPECFILES-013", async ({ given, when, then }) => {
  let text: string;
  await given(
    'the feature file "a.feature" with a plain scenario and a Scenario Outline whose Examples tables have the rows "qty 1, price 3" and "qty 2, price 6" and the row "qty 4", and an Examples section without a table',
    async () => {
      text = [
        "Feature: Demo",
        "  Scenario: Plain",
        "    When the user orders",
        "  Scenario Outline: Order <qty>",
        "    When the user orders <qty>",
        "    Examples:",
        "      | qty | price |",
        "      | 1   | 3     |",
        "      | 2   | 6     |",
        "    Examples:",
        "      | qty |",
        "      | 4   |",
        "    Examples:",
        "",
      ].join("\n");
    },
  );

  let scenarios: Scenario[];
  await when("the module parses the feature file", async () => {
    ({ scenarios } = parseFeature("a.feature", text));
  });

  await then(
    'the plain scenario has no rows and the Outline has the rows "qty 1, price 3", "qty 2, price 6" and "qty 4"',
    async () => {
      expect(scenarios.map((one) => one.rows)).toEqual([
        [],
        [{ qty: "1", price: "3" }, { qty: "2", price: "6" }, { qty: "4" }],
      ]);
    },
  );
});

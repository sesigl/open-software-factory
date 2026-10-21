import { parseFeature, statusOf } from "@opensoftware/spec-files";
import { scenario } from "@opensoftware/testkit";

scenario("SCN-SPECFILES-004", async ({ given, when, then }) => {
  let text: string;
  await given(
    'a scenario tagged "@status=planned" and a scenario tagged "@status=planned @status=implemented"',
    async () => {
      text = [
        "Feature: Demo",
        "  @status=planned",
        "  Scenario: One",
        "    When the user runs it",
        "  @status=planned @status=implemented",
        "  Scenario: Two",
        "    When the user runs it",
        "",
      ].join("\n");
    },
  );

  let statuses: (string | undefined)[];
  await when("the module asks for the status of each", async () => {
    statuses = parseFeature("a.feature", text).scenarios.map(statusOf);
  });

  await then('it gets "planned" for the first and no status for the second', async () => {
    expect(statuses).toEqual(["planned", undefined]);
  });
});

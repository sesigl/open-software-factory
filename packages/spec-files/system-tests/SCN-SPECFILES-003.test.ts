import { type ParseError, parseFeature, type Scenario } from "@opensoftware/spec-files";
import { scenario } from "@opensoftware/testkit";

scenario("SCN-SPECFILES-003", async ({ given, when, then }) => {
  let text: string;
  await given(
    'the feature file "broken.feature" whose line 12 is "Scenario without a colon" after 10 spaces',
    async () => {
      const notes = Array.from({ length: 8 }, () => "    # a note");
      text = [
        "Feature: Demo",
        "  Scenario: Fine",
        "    When the user runs it",
        ...notes,
        `${" ".repeat(10)}Scenario without a colon`,
        "",
      ].join("\n");
    },
  );

  let parsed: { scenarios: Scenario[]; errors: ParseError[] };
  await when("the module parses the feature file", async () => {
    parsed = parseFeature("broken.feature", text);
  });

  await then('it gets no scenarios and the error "Gherkin does not parse" in "broken.feature" at line 12', async () => {
    expect(parsed.scenarios).toEqual([]);
    expect(parsed.errors.map(({ file, line }) => ({ file, line }))).toEqual([{ file: "broken.feature", line: 12 }]);
    expect(parsed.errors[0]?.message).toMatch(/^Gherkin does not parse: /);
  });
});

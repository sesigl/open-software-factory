import { type ParseError, parseFeature, type Scenario } from "@opensoftware/spec-files";
import { scenario } from "@opensoftware/testkit";

scenario("SCN-SPECFILES-012", async ({ given, when, then }) => {
  let text: string;
  await given('the feature file "empty.feature" without any text', async () => {
    text = "";
  });

  let parsed: { scenarios: Scenario[]; errors: ParseError[] };
  await when("the module parses the feature file", async () => {
    parsed = parseFeature("empty.feature", text);
  });

  await then("it gets no scenarios and no errors", async () => {
    expect(parsed).toEqual({ scenarios: [], errors: [] });
  });
});

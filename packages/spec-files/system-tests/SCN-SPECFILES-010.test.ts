import { parseJUnit, scenarioIdOf } from "@opensoftware/spec-files";
import { scenario } from "@opensoftware/testkit";

scenario("SCN-SPECFILES-010", async ({ given, when, then }) => {
  let xml: string;
  await given('the test case "SCN-DEMO-002 works" with the property "scenario" "SCN-DEMO-001"', async () => {
    xml = [
      '<testsuite name="demo"><testcase name="SCN-DEMO-002 works">',
      '<properties><property name="scenario" value="SCN-DEMO-001"/></properties>',
      "</testcase></testsuite>",
    ].join("");
  });

  let ids: (string | undefined)[];
  await when('the module asks for its scenario ID with the pattern "SCN-[A-Z]+-\\d{3}"', async () => {
    ids = parseJUnit(xml).map((test) => scenarioIdOf(test, /SCN-[A-Z]+-\d{3}/));
  });

  await then('it gets "SCN-DEMO-001"', async () => {
    expect(ids).toEqual(["SCN-DEMO-001"]);
  });
});

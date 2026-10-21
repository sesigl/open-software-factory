import { parseJUnit, scenarioIdOf } from "@opensoftware/spec-files";
import { scenario } from "@opensoftware/testkit";

scenario("SCN-SPECFILES-011", async ({ given, when, then }) => {
  let xml: string;
  await given(
    'the test case "SCN-DEMO-002 works" in the class "system-tests/SCN-DEMO-003.test.ts" and the test case "works" in the same class, and the test case "works" in the class "system-tests/a.test.ts"',
    async () => {
      xml = [
        '<testsuite name="demo">',
        '<testcase name="SCN-DEMO-002 works" classname="system-tests/SCN-DEMO-003.test.ts"/>',
        '<testcase name="works" classname="system-tests/SCN-DEMO-003.test.ts"/>',
        '<testcase name="works" classname="system-tests/a.test.ts"/>',
        "</testsuite>",
      ].join("");
    },
  );

  let ids: (string | undefined)[];
  await when('the module asks for the scenario ID of each with the pattern "SCN-[A-Z]+-\\d{3}"', async () => {
    ids = parseJUnit(xml).map((test) => scenarioIdOf(test, /SCN-[A-Z]+-\d{3}/));
  });

  await then(
    'it gets "SCN-DEMO-002" for the first, "SCN-DEMO-003" for the second and no ID for the third',
    async () => {
      expect(ids).toEqual(["SCN-DEMO-002", "SCN-DEMO-003", undefined]);
    },
  );
});

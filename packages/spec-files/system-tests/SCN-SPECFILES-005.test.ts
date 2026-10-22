import { parseJUnit, type TestCase } from "@opensoftware/spec-files";
import { scenario } from "@opensoftware/testkit";

scenario("SCN-SPECFILES-005", async ({ given, when, then }) => {
  let xml: string;
  await given(
    'a JUnit report with the suite "system-tests/a.test.ts" and the test cases "passes" (1.5 seconds, property "scenario" "SCN-DEMO-001"), "fails" with a failure, "errs" with an error and "skips" skipped, and the empty suite "empty"',
    async () => {
      xml = [
        "<testsuites>",
        '  <testsuite name="system-tests/a.test.ts">',
        '    <testcase name="passes" classname="system-tests/a.test.ts" time="1.5">',
        '      <properties><property name="scenario" value="SCN-DEMO-001"/></properties>',
        "    </testcase>",
        '    <testcase name="fails"><failure message="expected 1"/></testcase>',
        '    <testcase name="errs"><error message="boom"/></testcase>',
        '    <testcase name="skips"><skipped/></testcase>',
        "  </testsuite>",
        '  <testsuite name="empty"></testsuite>',
        "</testsuites>",
      ].join("\n");
    },
  );

  let tests: TestCase[];
  await when("the module parses the report", async () => {
    tests = parseJUnit(xml);
  });

  await then(
    'it gets "passes" as passed after 1.5 seconds in the suite "system-tests/a.test.ts" with the property "scenario" "SCN-DEMO-001"',
    async () => {
      expect(tests[0]).toEqual({
        name: "passes",
        classname: "system-tests/a.test.ts",
        suite: "system-tests/a.test.ts",
        properties: { scenario: "SCN-DEMO-001" },
        status: "passed",
        reruns: 0,
        seconds: 1.5,
      });
    },
  );

  await then(
    'it gets "fails" and "errs" as failed and "skips" as skipped, each without properties, and no other test case',
    async () => {
      expect(tests.slice(1).map(({ name, status, properties }) => [name, status, properties])).toEqual([
        ["fails", "failed", {}],
        ["errs", "failed", {}],
        ["skips", "skipped", {}],
      ]);
    },
  );
});

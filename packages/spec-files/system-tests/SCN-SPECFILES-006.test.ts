import { parseJUnit, type TestCase } from "@opensoftware/spec-files";
import { scenario } from "@opensoftware/testkit";

scenario("SCN-SPECFILES-006", async ({ given, when, then }) => {
  let xml: string;
  await given(
    'a JUnit report whose test case "flaky" has one "flakyFailure", one "flakyError", one "rerunFailure" and one "rerunError" element',
    async () => {
      xml = [
        '<testsuites><testsuite name="demo"><testcase name="flaky">',
        '  <flakyFailure message="a"/><flakyError message="b"/><rerunFailure message="c"/><rerunError message="d"/>',
        "</testcase></testsuite></testsuites>",
      ].join("\n");
    },
  );

  let tests: TestCase[];
  await when("the module parses the report", async () => {
    tests = parseJUnit(xml);
  });

  await then('"flaky" has 4 reruns and the status passed', async () => {
    expect(tests.map(({ name, reruns, status }) => ({ name, reruns, status }))).toEqual([
      { name: "flaky", reruns: 4, status: "passed" },
    ]);
  });
});

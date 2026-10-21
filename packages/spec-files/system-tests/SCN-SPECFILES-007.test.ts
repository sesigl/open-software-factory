import { parseJUnit, type TestCase } from "@opensoftware/spec-files";
import { scenario } from "@opensoftware/testkit";

scenario("SCN-SPECFILES-007", async ({ given, when, then }) => {
  let xml: string;
  await given('a JUnit report whose root element is the suite "demo" with the test case "only"', async () => {
    xml = '<testsuite name="demo"><testcase name="only"/></testsuite>';
  });

  let tests: TestCase[];
  await when("the module parses the report", async () => {
    tests = parseJUnit(xml);
  });

  await then('it gets the test case "only" in the suite "demo"', async () => {
    expect(tests.map(({ name, suite }) => ({ name, suite }))).toEqual([{ name: "only", suite: "demo" }]);
  });
});

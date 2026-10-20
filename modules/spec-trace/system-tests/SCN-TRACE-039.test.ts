import { scenario } from "@opensoftware/testkit";
import { block, feature, junit, put, readReport, test } from "./repo.ts";

scenario("SCN-TRACE-039", async ({ sut, given, when, then }) => {
  await given(
    'a repository with the implemented scenario "SCN-SHOP-001" and its test and the planned scenario "SCN-SHOP-002" without one',
    async () => {
      await put(sut, {
        "features/checkout.feature": feature(
          block("@id=SCN-SHOP-001 @status=implemented"),
          block("@id=SCN-SHOP-002 @status=planned"),
        ),
        "tests/SCN-SHOP-001.test.ts": test("SCN-SHOP-001"),
      });
    },
  );

  await given('a JUnit report in which the test of "SCN-SHOP-001" passed', async () => {
    await sut.files.put("$INPUT/reports/junit/checkout.xml", junit([{ id: "SCN-SHOP-001" }]));
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "spec-trace report"', async () => {
    run = await sut.cli(["report"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then(
    'the output ends with "2 scenarios: 1 implemented, 1 planned, 0 deprecated; 1 with a test, 1 passed"',
    async () => {
      expect(run.stdout.trimEnd()).toMatch(
        /2 scenarios: 1 implemented, 1 planned, 0 deprecated; 1 with a test, 1 passed$/,
      );
    },
  );

  await then(
    'the report lists "SCN-SHOP-001" as "implemented" with the result "passed" and "SCN-SHOP-002" as "planned" with the result "not run"',
    async () => {
      const report = await readReport(sut);
      expect(report.scenarios).toMatchObject([
        { id: "SCN-SHOP-001", status: "implemented", result: "passed" },
        { id: "SCN-SHOP-002", status: "planned", result: "not run" },
      ]);
    },
  );
});

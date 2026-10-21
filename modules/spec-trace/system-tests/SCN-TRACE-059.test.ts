import { scenario } from "@opensoftware/testkit";
import { actionReport, junit, traced } from "./repo.ts";

scenario("SCN-TRACE-059", async ({ sut, given, when, then }) => {
  await given('a repository with the implemented scenario "SCN-SHOP-001" and its test', async () => {
    await traced(sut);
  });

  await given('a JUnit report in which the test of "SCN-SHOP-001" passed', async () => {
    await sut.files.put("$INPUT/reports/junit/checkout.xml", junit([{ id: "SCN-SHOP-001" }]));
  });

  let run: Awaited<ReturnType<typeof sut.action>>;
  await when('a push workflow runs the action with "out: build/trace.json"', async () => {
    run = await sut.action({ out: "build/trace.json" });
  });

  await then("the action succeeds", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then('the output contains "PASS ok"', async () => {
    expect(run.stdout).toContain("PASS ok");
  });

  await then(
    'the report named in the action output "report" lists "SCN-SHOP-001" with the result "passed"',
    async () => {
      expect(run.outputs.report).toBe("build/trace.json");
      const report = await actionReport(sut, run.outputs);
      expect(report.scenarios).toMatchObject([{ id: "SCN-SHOP-001", result: "passed" }]);
    },
  );
});

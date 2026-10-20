import { scenario } from "@opensoftware/testkit";
import { readReport, traced } from "./repo.ts";

scenario("SCN-TRACE-041", async ({ sut, given, when, then }) => {
  await given('a repository with the implemented scenario "SCN-SHOP-001" and its test', async () => {
    await traced(sut);
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "spec-trace report"', async () => {
    run = await sut.cli(["report"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then('the report lists "SCN-SHOP-001" with the result null and has no finding', async () => {
    const report = await readReport(sut);
    expect(report.scenarios).toMatchObject([{ id: "SCN-SHOP-001", result: null, evidence: null }]);
    expect(report.findings).toEqual([]);
  });
});

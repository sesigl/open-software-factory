import { scenario } from "@opensoftware/testkit";
import { readReport, traced } from "./repo.ts";

scenario("SCN-TRACE-054", async ({ sut, given, when, then }) => {
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

  await then("the report has the changes null", async () => {
    const report = await readReport(sut);
    expect(report.changes).toBeNull();
  });
});

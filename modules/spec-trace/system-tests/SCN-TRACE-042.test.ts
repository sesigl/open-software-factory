import { scenario } from "@opensoftware/testkit";
import { block, feature, put, readReport } from "./repo.ts";

scenario("SCN-TRACE-042", async ({ sut, given, when, then }) => {
  await given('a repository with the implemented scenario "SCN-SHOP-001" and no test', async () => {
    await put(sut, { "features/checkout.feature": feature(block("@id=SCN-SHOP-001 @status=implemented")) });
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "spec-trace report"', async () => {
    run = await sut.cli(["report"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then(
    'the report has the TRACE finding "SCN-SHOP-001 is implemented but has no system test" at "features/checkout.feature:4"',
    async () => {
      const report = await readReport(sut);
      expect(report.findings).toEqual([
        {
          rule: "TRACE",
          file: "features/checkout.feature",
          line: 4,
          message: "SCN-SHOP-001 is implemented but has no system test",
        },
      ]);
    },
  );
});

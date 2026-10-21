import { scenario } from "@opensoftware/testkit";
import { baseCommit, block, feature, put, readReport } from "./repo.ts";

scenario("SCN-TRACE-051", async ({ sut, given, when, then }) => {
  let base = "";
  await given('a base commit with the planned scenario "SCN-SHOP-001" and its test', async () => {
    base = await baseCommit(sut, "planned");
  });

  await given('the scenario "SCN-SHOP-001" marked implemented since the base commit', async () => {
    await put(sut, { "features/checkout.feature": feature(block("@id=SCN-SHOP-001 @status=implemented")) });
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "spec-trace report --base" with the base commit', async () => {
    run = await sut.cli(["report", "--base", base]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then(
    'the report lists "SCN-SHOP-001" with the status "planned" in the base and "implemented" now',
    async () => {
      const report = await readReport(sut);
      expect(report.changes?.status).toEqual([{ id: "SCN-SHOP-001", from: "planned", to: "implemented" }]);
      expect(report.changes?.steps).toEqual([]);
    },
  );
});

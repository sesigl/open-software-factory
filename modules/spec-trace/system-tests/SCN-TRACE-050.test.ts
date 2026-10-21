import { scenario } from "@opensoftware/testkit";
import { baseCommit, block, feature, put, readReport } from "./repo.ts";

scenario("SCN-TRACE-050", async ({ sut, given, when, then }) => {
  let base = "";
  await given('a base commit with the implemented scenario "SCN-SHOP-001" and its test', async () => {
    base = await baseCommit(sut);
  });

  await given('the planned scenario "SCN-SHOP-002" added since the base commit', async () => {
    await put(sut, {
      "features/checkout.feature": feature(
        block("@id=SCN-SHOP-001 @status=implemented"),
        block("@id=SCN-SHOP-002 @status=planned"),
      ),
    });
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "spec-trace report --base" with the base commit', async () => {
    run = await sut.cli(["report", "--base", base]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then(
    'the output ends with "since the base: 1 added, 0 removed, 0 with a new status, 0 with new steps"',
    async () => {
      expect(run.stdout.trimEnd()).toMatch(
        /since the base: 1 added, 0 removed, 0 with a new status, 0 with new steps$/,
      );
    },
  );

  await then('the report lists "SCN-SHOP-002" as added since the base commit', async () => {
    const report = await readReport(sut);
    expect(report.changes).toEqual({ base, added: ["SCN-SHOP-002"], removed: [], status: [], steps: [] });
  });
});

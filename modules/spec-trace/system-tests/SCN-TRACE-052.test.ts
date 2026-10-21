import { scenario } from "@opensoftware/testkit";
import { baseCommit, block, feature, put, readReport, STEPS } from "./repo.ts";

scenario("SCN-TRACE-052", async ({ sut, given, when, then }) => {
  let base = "";
  await given('a base commit with the implemented scenario "SCN-SHOP-001" and its test', async () => {
    base = await baseCommit(sut);
  });

  await given(
    'the step "Then the order is paid" of "SCN-SHOP-001" changed to "Then the order is shipped" since the base commit',
    async () => {
      const steps = [...STEPS.slice(0, 2), "Then the order is shipped"];
      await put(sut, { "features/checkout.feature": feature(block("@id=SCN-SHOP-001 @status=implemented", steps)) });
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "spec-trace report --base" with the base commit', async () => {
    run = await sut.cli(["report", "--base", base]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then('the report lists "SCN-SHOP-001" as a scenario with new steps since the base commit', async () => {
    const report = await readReport(sut);
    expect(report.changes).toMatchObject({ added: [], removed: [], status: [], steps: ["SCN-SHOP-001"] });
  });
});

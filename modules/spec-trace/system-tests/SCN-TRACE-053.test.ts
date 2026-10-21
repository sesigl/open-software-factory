import { scenario } from "@opensoftware/testkit";
import { block, feature, put, readReport } from "./repo.ts";

scenario("SCN-TRACE-053", async ({ sut, given, when, then }) => {
  let base = "";
  await given('a base commit with the planned scenarios "SCN-SHOP-001" and "SCN-SHOP-002"', async () => {
    await put(sut, {
      "features/checkout.feature": feature(
        block("@id=SCN-SHOP-001 @status=planned"),
        block("@id=SCN-SHOP-002 @status=planned"),
      ),
    });
    base = await sut.git.commit("base");
  });

  await given('the scenario "SCN-SHOP-002" deleted since the base commit', async () => {
    await put(sut, { "features/checkout.feature": feature(block("@id=SCN-SHOP-001 @status=planned")) });
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "spec-trace report --base" with the base commit', async () => {
    run = await sut.cli(["report", "--base", base]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then('the report lists "SCN-SHOP-002" as removed since the base commit', async () => {
    const report = await readReport(sut);
    expect(report.changes).toMatchObject({ added: [], removed: ["SCN-SHOP-002"], status: [], steps: [] });
  });
});

import { scenario } from "@opensoftware/testkit";
import { baseCommit, block, feature, outline, put, readReport, row } from "./repo.ts";

scenario("SCN-TRACE-071", async ({ sut, given, when, then }) => {
  let base = "";
  await given('a base commit with the implemented scenario "SCN-SHOP-001" and its test', async () => {
    base = await baseCommit(sut);
  });

  await given(
    'the planned Scenario Outline "SCN-SHOP-002" with the rows "qty 1, price 3" and "qty 2, price 6" added since the base commit',
    async () => {
      await put(sut, {
        "features/checkout.feature": feature(
          block("@id=SCN-SHOP-001 @status=implemented"),
          outline("@id=SCN-SHOP-002 @status=planned", [
            [1, 3],
            [2, 6],
          ]),
        ),
      });
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "spec-trace report --base" with the base commit', async () => {
    run = await sut.cli(["report", "--base", base]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then(
    'the report lists "SCN-SHOP-002" as added and its rows "qty 1, price 3" and "qty 2, price 6" as added',
    async () => {
      const report = await readReport(sut);
      expect(report.changes).toMatchObject({
        added: ["SCN-SHOP-002"],
        examples: [{ id: "SCN-SHOP-002", added: [row(1, 3), row(2, 6)], removed: [], changed: [] }],
      });
    },
  );
});

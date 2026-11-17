import { scenario } from "@opensoftware/testkit";
import { feature, outline, put, readReport } from "./repo.ts";

scenario("SCN-TRACE-073", async ({ sut, given, when, then }) => {
  let base = "";
  await given(
    'a base commit with the planned Scenario Outline "SCN-SHOP-001" with the rows "qty 1, price 3", "qty 2, price 6" and "qty 2, price 6"',
    async () => {
      await put(sut, {
        "features/checkout.feature": feature(
          outline("@id=SCN-SHOP-001 @status=planned", [
            [1, 3],
            [2, 6],
            [2, 6],
          ]),
        ),
      });
      base = await sut.git.commit("base");
    },
  );

  await given(
    'since the base commit its rows are "qty 2, price 6", "qty 1, price 3" and "qty 2, price 6"',
    async () => {
      await put(sut, {
        "features/checkout.feature": feature(
          outline("@id=SCN-SHOP-001 @status=planned", [
            [2, 6],
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
    'the output ends with "since the base: 0 added, 0 removed, 0 with a new status, 0 with new steps"',
    async () => {
      expect(run.stdout.trimEnd()).toMatch(
        /since the base: 0 added, 0 removed, 0 with a new status, 0 with new steps$/,
      );
    },
  );

  await then("the report lists no Outline with new examples", async () => {
    const report = await readReport(sut);
    expect(report.changes).not.toHaveProperty("examples");
  });
});

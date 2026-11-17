import { scenario } from "@opensoftware/testkit";
import { feature, outline, put, readReport, row } from "./repo.ts";

scenario("SCN-TRACE-072", async ({ sut, given, when, then }) => {
  let base = "";
  await given(
    'a base commit with the planned Scenario Outline "SCN-SHOP-001" with the rows "qty 2, price 6", "qty 3, price 9" and "qty 3, price 10"',
    async () => {
      await put(sut, {
        "features/checkout.feature": feature(
          outline("@id=SCN-SHOP-001 @status=planned", [
            [2, 6],
            [3, 9],
            [3, 10],
          ]),
        ),
      });
      base = await sut.git.commit("base");
    },
  );

  await given(
    'since the base commit its rows are "qty 2, price 7", "qty 2, price 8" and "qty 3, price 11"',
    async () => {
      await put(sut, {
        "features/checkout.feature": feature(
          outline("@id=SCN-SHOP-001 @status=planned", [
            [2, 7],
            [2, 8],
            [3, 11],
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
    'the report lists for "SCN-SHOP-001" the rows "qty 2, price 7", "qty 2, price 8" and "qty 3, price 11" as added, "qty 2, price 6", "qty 3, price 9" and "qty 3, price 10" as removed and no row as changed',
    async () => {
      const report = await readReport(sut);
      expect(report.changes?.examples).toEqual([
        {
          id: "SCN-SHOP-001",
          added: [row(2, 7), row(2, 8), row(3, 11)],
          removed: [row(2, 6), row(3, 9), row(3, 10)],
          changed: [],
        },
      ]);
    },
  );
});

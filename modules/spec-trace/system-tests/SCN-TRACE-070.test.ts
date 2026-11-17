import { scenario } from "@opensoftware/testkit";
import { feature, outline, put, readReport, row } from "./repo.ts";

scenario("SCN-TRACE-070", async ({ sut, given, when, then }) => {
  let base = "";
  await given(
    'a base commit with the planned Scenario Outline "SCN-SHOP-001" with the rows "qty 1, price 3", "qty 2, price 6" and "qty 4, price 12"',
    async () => {
      await put(sut, {
        "features/checkout.feature": feature(
          outline("@id=SCN-SHOP-001 @status=planned", [
            [1, 3],
            [2, 6],
            [4, 12],
          ]),
        ),
      });
      base = await sut.git.commit("base");
    },
  );

  await given(
    'since the base commit its rows are "qty 1, price 3", "qty 2, price 7" and "qty 5, price 15"',
    async () => {
      await put(sut, {
        "features/checkout.feature": feature(
          outline("@id=SCN-SHOP-001 @status=planned", [
            [1, 3],
            [2, 7],
            [5, 15],
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
    'the output ends with "since the base: 0 added, 0 removed, 0 with a new status, 0 with new steps, 1 with new examples"',
    async () => {
      expect(run.stdout.trimEnd()).toMatch(
        /since the base: 0 added, 0 removed, 0 with a new status, 0 with new steps, 1 with new examples$/,
      );
    },
  );

  await then(
    'the report lists for "SCN-SHOP-001" the row "qty 5, price 15" as added, "qty 4, price 12" as removed and "qty 2, price 6" as changed to "qty 2, price 7"',
    async () => {
      const report = await readReport(sut);
      expect(report.changes).toEqual({
        base,
        added: [],
        removed: [],
        status: [],
        steps: [],
        examples: [
          {
            id: "SCN-SHOP-001",
            added: [row(5, 15)],
            removed: [row(4, 12)],
            changed: [{ from: row(2, 6), to: row(2, 7) }],
          },
        ],
      });
    },
  );
});

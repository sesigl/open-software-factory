import { scenario } from "@opensoftware/testkit";
import { feature, outline, put } from "./repo.ts";

scenario("SCN-TRACE-074", async ({ sut, given, when, then }) => {
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
  await when('the developer runs "spec-trace report --summary summary.md --base" with the base commit', async () => {
    run = await sut.cli(["report", "--summary", "summary.md", "--base", base]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then(
    'the file "summary.md" in the working folder has the lines "since the base: 0 added, 0 removed, 0 with a new status, 0 with new steps, 1 with new examples.", "", "| Scenario | Change |", "| --- | --- |", "| SCN-SHOP-001 | example added: qty = 5, price = 15 |", "| SCN-SHOP-001 | example removed: qty = 4, price = 12 |" and "| SCN-SHOP-001 | example changed: qty = 2, price = 6 → qty = 2, price = 7 |" after the heading of the changes',
    async () => {
      const lines = (await sut.files.read("$INPUT/summary.md")).split("\n");
      const heading = lines.indexOf(`### Changes since \`${base}\``);
      expect(heading, lines.join("\n")).toBeGreaterThan(0);
      expect(lines.slice(heading + 1, heading + 10)).toEqual([
        "",
        "since the base: 0 added, 0 removed, 0 with a new status, 0 with new steps, 1 with new examples.",
        "",
        "| Scenario | Change |",
        "| --- | --- |",
        "| SCN-SHOP-001 | example added: qty = 5, price = 15 |",
        "| SCN-SHOP-001 | example removed: qty = 4, price = 12 |",
        "| SCN-SHOP-001 | example changed: qty = 2, price = 6 → qty = 2, price = 7 |",
        "",
      ]);
    },
  );
});

import { scenario } from "@opensoftware/testkit";
import { block, feature, put, STEPS } from "./repo.ts";

scenario("SCN-TRACE-066", async ({ sut, given, when, then }) => {
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

  await given(
    'since the base commit "SCN-SHOP-001" is implemented with a new step and no test, "SCN-SHOP-002" is deleted and the planned "SCN-SHOP-003" is added',
    async () => {
      const steps = [...STEPS.slice(0, 2), "Then the order is shipped"];
      await put(sut, {
        "features/checkout.feature": feature(
          block("@id=SCN-SHOP-001 @status=implemented", steps),
          block("@id=SCN-SHOP-003 @status=planned"),
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
    'the file "summary.md" in the working folder has the lines "## spec-trace", "", "2 scenarios: 1 implemented, 1 planned, 0 deprecated; 0 with a test, 0 passed", "", "### Changes since `<base>`", "", "since the base: 1 added, 1 removed, 1 with a new status, 1 with new steps.", "", "| Scenario | Change |", "| --- | --- |", "| SCN-SHOP-003 | added |", "| SCN-SHOP-002 | removed |", "| SCN-SHOP-001 | status planned → implemented |", "| SCN-SHOP-001 | steps changed |", "", "### Findings", "", "| Rule | Where | Finding |", "| --- | --- | --- |", "| TRACE | features/checkout.feature:4 | SCN-SHOP-001 is implemented but has no system test |", ""',
    async () => {
      expect((await sut.files.read("$INPUT/summary.md")).split("\n")).toEqual([
        "## spec-trace",
        "",
        "2 scenarios: 1 implemented, 1 planned, 0 deprecated; 0 with a test, 0 passed",
        "",
        `### Changes since \`${base}\``,
        "",
        "since the base: 1 added, 1 removed, 1 with a new status, 1 with new steps.",
        "",
        "| Scenario | Change |",
        "| --- | --- |",
        "| SCN-SHOP-003 | added |",
        "| SCN-SHOP-002 | removed |",
        "| SCN-SHOP-001 | status planned → implemented |",
        "| SCN-SHOP-001 | steps changed |",
        "",
        "### Findings",
        "",
        "| Rule | Where | Finding |",
        "| --- | --- | --- |",
        "| TRACE | features/checkout.feature:4 | SCN-SHOP-001 is implemented but has no system test |",
        "",
      ]);
    },
  );
});

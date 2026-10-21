import { scenario } from "@opensoftware/testkit";
import { actionReport, baseCommit, block, feature, put } from "./repo.ts";

scenario("SCN-TRACE-062", async ({ sut, given, when, then }) => {
  let base = "";
  await given('a base commit with the planned scenario "SCN-SHOP-001" and its test', async () => {
    base = await baseCommit(sut, "planned");
  });

  await given('the planned scenario "SCN-SHOP-002" added since the base commit', async () => {
    await put(sut, {
      "features/checkout.feature": feature(
        block("@id=SCN-SHOP-001 @status=planned"),
        block("@id=SCN-SHOP-002 @status=planned"),
      ),
    });
  });

  let run: Awaited<ReturnType<typeof sut.action>>;
  await when(
    'a pull request workflow whose base is the base commit runs the action with "rules: SPEC" and "out: build/trace.json"',
    async () => {
      const event = { pull_request: { number: 7, base: { sha: base } } };
      run = await sut.action({ rules: "SPEC", out: "build/trace.json" }, { event });
    },
  );

  await then("the action succeeds", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then(
    'the report named in the action output "report" lists "SCN-SHOP-002" as added since the base commit',
    async () => {
      const report = await actionReport(sut, run.outputs);
      expect(report.changes).toMatchObject({ base, added: ["SCN-SHOP-002"] });
    },
  );
});

import { scenario } from "@opensoftware/testkit";
import { actionReport, proofBundle, traced } from "./repo.ts";

scenario("SCN-TRACE-064", async ({ sut, given, when, then }) => {
  await given('a repository with the implemented scenario "SCN-SHOP-001" and its test', async () => {
    await traced(sut);
  });

  await given('a proof bundle in "evidence" with two artifacts for "SCN-SHOP-001"', async () => {
    await proofBundle(sut);
  });

  let run: Awaited<ReturnType<typeof sut.action>>;
  await when(
    'a push workflow runs the action with "rules: SPEC", "evidence: evidence" and "out: build/trace.json"',
    async () => {
      run = await sut.action({ rules: "SPEC", evidence: "evidence", out: "build/trace.json" });
    },
  );

  await then("the action succeeds", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then('the report named in the action output "report" lists "SCN-SHOP-001" with the evidence 2', async () => {
    const report = await actionReport(sut, run.outputs);
    expect(report.scenarios).toMatchObject([{ id: "SCN-SHOP-001", evidence: 2 }]);
  });
});

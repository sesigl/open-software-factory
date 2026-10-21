import { scenario } from "@opensoftware/testkit";
import { traced } from "./repo.ts";

scenario("SCN-TRACE-063", async ({ sut, given, when, then }) => {
  await given('a repository with the implemented scenario "SCN-SHOP-001" and its test', async () => {
    await traced(sut);
  });

  let run: Awaited<ReturnType<typeof sut.action>>;
  await when('a push workflow runs the action with "rules: SPEC"', async () => {
    run = await sut.action({ rules: "SPEC" });
  });

  await then("the action succeeds", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then('the job summary contains "## spec-trace"', async () => {
    expect(run.summary).toContain("## spec-trace");
  });
});

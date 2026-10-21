import { scenario } from "@opensoftware/testkit";
import { block, feature, put } from "./repo.ts";

scenario("SCN-TRACE-061", async ({ sut, given, when, then }) => {
  await given('a repository with the implemented scenario "SCN-SHOP-001" and no test', async () => {
    await put(sut, { "features/checkout.feature": feature(block("@id=SCN-SHOP-001 @status=implemented")) });
  });

  let run: Awaited<ReturnType<typeof sut.action>>;
  await when('a push workflow runs the action with "rules: SPEC"', async () => {
    run = await sut.action({ rules: "SPEC" });
  });

  await then("the action succeeds", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then('the output contains "SPEC ok" and not "TRACE"', async () => {
    expect(run.stdout).toContain("SPEC ok");
    expect(run.stdout).not.toContain("TRACE");
  });
});

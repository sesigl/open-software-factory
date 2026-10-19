import { scenario } from "@osf/testkit";
import { DEMO_TEST, demoModule, systemTest } from "./repo.ts";

scenario("SCN-REPO-004", async ({ sut, given, when, then }) => {
  await given('a repository with the implemented scenario "SCN-DEMO-001" and its system test', async () => {
    for (const [path, content] of Object.entries(demoModule())) await sut.files.put(path, content);
  });

  await given('the test labels the step \'When the user runs "demo run"\' as "the user runs demo"', async () => {
    await sut.files.put(DEMO_TEST, systemTest({ whenLabel: "the user runs demo" }));
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "osf check STEPS"', async () => {
    run = await sut.cli(["check", "STEPS"]);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode).toBe(1);
  });

  await then('the output contains "STEPS modules/demo/system-tests/SCN-DEMO-001.test.ts:7"', async () => {
    expect(run.stdout).toContain("STEPS modules/demo/system-tests/SCN-DEMO-001.test.ts:7");
  });

  await then('the output contains "differs from the step"', async () => {
    expect(run.stdout).toContain("differs from the step");
  });
});

import { scenario } from "@osf/testkit";
import { DEMO_TEST, demoModule, systemTest } from "./repo.ts";

scenario("SCN-REPO-012", async ({ sut, given, when, then }) => {
  await given('a repository with the implemented scenario "SCN-DEMO-001" and its system test', async () => {
    for (const [path, content] of Object.entries(demoModule())) await sut.files.put(path, content);
  });

  await given("the test's then step asserts only on a constant", async () => {
    await sut.files.put(DEMO_TEST, systemTest({ assertion: "expect(1).toBe(1);" }));
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "osf check ASSERT"', async () => {
    run = await sut.cli(["check", "ASSERT"]);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode).toBe(1);
  });

  await then('the output contains "ASSERT modules/demo/system-tests/SCN-DEMO-001.test.ts"', async () => {
    expect(run.stdout).toContain("ASSERT modules/demo/system-tests/SCN-DEMO-001.test.ts");
  });
});

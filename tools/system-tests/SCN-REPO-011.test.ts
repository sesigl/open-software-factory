import { scenario } from "@opensoftware/testkit";
import { DEMO_TEST, demoModule, systemTest } from "./repo.ts";

scenario("SCN-REPO-011", async ({ sut, given, when, then }) => {
  await given('a repository with the implemented scenario "SCN-DEMO-001" and its system test', async () => {
    for (const [path, content] of Object.entries(demoModule())) await sut.files.put(path, content);
  });

  await given('the test file contains "test.skip"', async () => {
    await sut.files.put(DEMO_TEST, systemTest({ trailer: 'test.skip("later", () => {});' }));
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "osf check NOSKIP"', async () => {
    run = await sut.cli(["check", "NOSKIP"]);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode).toBe(1);
  });

  await then('the output contains "NOSKIP modules/demo/system-tests/SCN-DEMO-001.test.ts"', async () => {
    expect(run.stdout).toContain("NOSKIP modules/demo/system-tests/SCN-DEMO-001.test.ts");
  });
});

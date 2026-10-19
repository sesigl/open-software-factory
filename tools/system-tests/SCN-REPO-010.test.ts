import { scenario } from "@osf/testkit";
import { DEMO_TEST, demoModule, systemTest } from "./repo.ts";

scenario("SCN-REPO-010", async ({ sut, given, when, then }) => {
  await given('a repository with the implemented scenario "SCN-DEMO-001" and its system test', async () => {
    for (const [path, content] of Object.entries(demoModule())) await sut.files.put(path, content);
  });

  await given('the test passes the environment variable "DEMO_SECRET_MODE" to the module', async () => {
    await sut.files.put(DEMO_TEST, systemTest({ cliOptions: ', { env: { DEMO_SECRET_MODE: "1" } }' }));
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "osf check BOUNDARY-ENV"', async () => {
    run = await sut.cli(["check", "BOUNDARY-ENV"]);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode).toBe(1);
  });

  await then('the output contains "BOUNDARY-ENV modules/demo/system-tests/SCN-DEMO-001.test.ts"', async () => {
    expect(run.stdout).toContain("BOUNDARY-ENV modules/demo/system-tests/SCN-DEMO-001.test.ts");
  });

  await then('the output contains "DEMO_SECRET_MODE"', async () => {
    expect(run.stdout).toContain("DEMO_SECRET_MODE");
  });
});

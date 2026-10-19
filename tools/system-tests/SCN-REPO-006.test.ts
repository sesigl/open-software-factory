import { scenario } from "@opensoftware/testkit";
import { DEMO_TEST, demoModule, systemTest } from "./repo.ts";

scenario("SCN-REPO-006", async ({ sut, given, when, then }) => {
  await given('a repository with the implemented scenario "SCN-DEMO-001" and its system test', async () => {
    for (const [path, content] of Object.entries(demoModule())) await sut.files.put(path, content);
    await sut.files.put("modules/demo/src/run.ts", "export const run = () => 0;\n");
  });

  await given('the test imports "../src/run.ts"', async () => {
    await sut.files.put(DEMO_TEST, systemTest({ extraImport: 'import { run as direct } from "../src/run.ts";' }));
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "osf check BOUNDARY-STATIC"', async () => {
    run = await sut.cli(["check", "BOUNDARY-STATIC"]);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode).toBe(1);
  });

  await then('the output contains "BOUNDARY-STATIC modules/demo/system-tests/SCN-DEMO-001.test.ts:2"', async () => {
    expect(run.stdout).toContain("BOUNDARY-STATIC modules/demo/system-tests/SCN-DEMO-001.test.ts:2");
  });
});

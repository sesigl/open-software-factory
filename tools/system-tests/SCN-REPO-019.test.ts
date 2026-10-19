import { scenario } from "@opensoftware/testkit";
import { DEMO_TEST, demoModule, systemTest } from "./repo.ts";

scenario("SCN-REPO-019", async ({ sut, given, when, then }) => {
  await given('a repository with the implemented scenario "SCN-DEMO-001" and its system test', async () => {
    for (const [path, content] of Object.entries(demoModule())) await sut.files.put(path, content);
  });

  await given('the test imports "node:fs"', async () => {
    await sut.files.put(DEMO_TEST, systemTest({ extraImport: 'import { readFileSync } from "node:fs";' }));
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "osf check BOUNDARY-STATIC"', async () => {
    run = await sut.cli(["check", "BOUNDARY-STATIC"]);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode).toBe(1);
  });

  await then(
    "the output contains 'BOUNDARY-STATIC modules/demo/system-tests/SCN-DEMO-001.test.ts:2 import \"node:fs\"'",
    async () => {
      expect(run.stdout).toContain('BOUNDARY-STATIC modules/demo/system-tests/SCN-DEMO-001.test.ts:2 import "node:fs"');
    },
  );
});

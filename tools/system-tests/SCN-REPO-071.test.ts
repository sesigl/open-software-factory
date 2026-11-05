import { scenario } from "@opensoftware/testkit";
import { DEMO_TEST_FILE, demoTest, putCached, runAffected } from "./affected.ts";

scenario("SCN-REPO-071", async ({ sut, given, when, then }) => {
  await given(
    'a repository that caches the system tests of the modules "demo" and "other" by the rules of ADR 0081',
    async () => {
      await putCached(sut);
    },
  );

  await given('"modules/demo/system-tests/SCN-DEMO-001.test.ts" reads "../../other/features/a.feature"', async () => {
    await putCached(sut, {
      [DEMO_TEST_FILE]: demoTest(
        'await sut.files.read(new URL("../../other/features/a.feature", import.meta.url).pathname);',
      ),
    });
  });

  let run: Awaited<ReturnType<typeof runAffected>>;
  await when('the developer runs "osf check AFFECTED"', async () => {
    run = await runAffected(sut);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then(
    'the output contains "AFFECTED modules/demo/system-tests/SCN-DEMO-001.test.ts:3 reads "../../other/features/a.feature" outside its package: declare the package or list the file in globalDependencies of turbo.json"',
    async () => {
      expect(run.stdout).toContain(
        'AFFECTED modules/demo/system-tests/SCN-DEMO-001.test.ts:3 reads "../../other/features/a.feature" outside its package: declare the package or list the file in globalDependencies of turbo.json',
      );
    },
  );
});

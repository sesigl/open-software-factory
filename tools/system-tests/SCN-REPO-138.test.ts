import { scenario } from "@opensoftware/testkit";
import { DEMO_TEST_FILE, demoTest, opensPage, putCached, runAffected } from "./affected.ts";

scenario("SCN-REPO-138", async ({ sut, given, when, then }) => {
  await given(
    'a repository that caches the system tests of the modules "demo" and "other" by the rules of ADR 0081',
    async () => {
      await putCached(sut);
    },
  );

  await given('"modules/demo/system-tests/SCN-DEMO-001.test.ts" opens a page with "sut.browser"', async () => {
    await putCached(sut, { [DEMO_TEST_FILE]: demoTest(opensPage) });
  });

  let run: Awaited<ReturnType<typeof runAffected>>;
  await when('the developer runs "osf check AFFECTED"', async () => {
    run = await runAffected(sut);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then(
    'the output contains "AFFECTED .github/test-suites.yml:1 the system tests of @opensoftware/demo open pages with sut.browser: the suite demo needs "browser: chromium""',
    async () => {
      expect(run.stdout).toContain(
        'AFFECTED .github/test-suites.yml:1 the system tests of @opensoftware/demo open pages with sut.browser: the suite demo needs "browser: chromium"',
      );
    },
  );
});

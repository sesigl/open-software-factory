import { scenario } from "@opensoftware/testkit";
import { DEMO_TEST_FILE, demoTest, opensPage, putCached, runAffected } from "./affected.ts";

const SUITES =
  '- suite: demo\n  filter: "@opensoftware/demo"\n  browser: chromium\n- suite: rest\n  filter: "!@opensoftware/demo"\n';

scenario("SCN-REPO-139", async ({ sut, given, when, then }) => {
  await given(
    'a repository that caches the system tests of the modules "demo" and "other" by the rules of ADR 0081',
    async () => {
      await putCached(sut);
    },
  );

  await given('"modules/demo/system-tests/SCN-DEMO-001.test.ts" opens a page with "sut.browser"', async () => {
    await putCached(sut, { [DEMO_TEST_FILE]: demoTest(opensPage) });
  });

  await given('the suite "demo" of ".github/test-suites.yml" has "browser: chromium"', async () => {
    await putCached(sut, {
      [DEMO_TEST_FILE]: demoTest(opensPage),
      ".github/test-suites.yml": SUITES,
    });
  });

  let run: Awaited<ReturnType<typeof runAffected>>;
  await when('the developer runs "osf check AFFECTED"', async () => {
    run = await runAffected(sut);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then('the output contains "AFFECTED ok"', async () => {
    expect(run.stdout).toContain("AFFECTED ok");
  });
});

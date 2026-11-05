import { scenario } from "@opensoftware/testkit";
import { DEMO_TEST_FILE, demoTest, putCached, runAffected } from "./affected.ts";

scenario("SCN-REPO-069", async ({ sut, given, when, then }) => {
  await given(
    'a repository that caches the system tests of the modules "demo" and "other" by the rules of ADR 0081',
    async () => {
      await putCached(sut);
    },
  );

  await given('the adapter "adapters/forge/github" named "@opensoftware/forge-github"', async () => {
    await putCached(sut, {
      "adapters/forge/github/package.json": '{ "name": "@opensoftware/forge-github", "version": "0.1.0" }\n',
    });
  });

  await given('"modules/demo/system-tests/SCN-DEMO-001.test.ts" starts the adapter "forge/github"', async () => {
    await putCached(sut, {
      ...{ "adapters/forge/github/package.json": '{ "name": "@opensoftware/forge-github", "version": "0.1.0" }\n' },
      [DEMO_TEST_FILE]: demoTest('sut.adapter("forge/github");'),
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
    'the output contains "AFFECTED modules/demo/system-tests/SCN-DEMO-001.test.ts:3 starts the adapter "forge/github", which modules/demo/package.json does not declare"',
    async () => {
      expect(run.stdout).toContain(
        'AFFECTED modules/demo/system-tests/SCN-DEMO-001.test.ts:3 starts the adapter "forge/github", which modules/demo/package.json does not declare',
      );
    },
  );
});

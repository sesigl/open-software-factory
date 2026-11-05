import { scenario } from "@opensoftware/testkit";
import { putCached, runAffected } from "./affected.ts";
import { vitestConfig } from "./repo.ts";

scenario("SCN-REPO-074", async ({ sut, given, when, then }) => {
  await given(
    'a repository that caches the system tests of the modules "demo" and "other" by the rules of ADR 0081',
    async () => {
      await putCached(sut);
    },
  );

  await given(
    '"modules/demo/vitest.config.ts" writes its JUnit results to "../../reports/junit/demo.xml"',
    async () => {
      await putCached(sut, { "modules/demo/vitest.config.ts": vitestConfig("../../reports/junit/demo.xml") });
    },
  );

  let run: Awaited<ReturnType<typeof runAffected>>;
  await when('the developer runs "osf check AFFECTED"', async () => {
    run = await runAffected(sut);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then(
    'the output contains "AFFECTED modules/demo/vitest.config.ts:1 writes its JUnit results elsewhere than "reports/junit.xml", which turbo stores and replays"',
    async () => {
      expect(run.stdout).toContain(
        'AFFECTED modules/demo/vitest.config.ts:1 writes its JUnit results elsewhere than "reports/junit.xml", which turbo stores and replays',
      );
    },
  );
});

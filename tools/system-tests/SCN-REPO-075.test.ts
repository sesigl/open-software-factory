import { scenario } from "@opensoftware/testkit";
import { putCached, runAffected } from "./affected.ts";
import { cachedTurbo, TEST_GLOBALS } from "./repo.ts";

scenario("SCN-REPO-075", async ({ sut, given, when, then }) => {
  await given(
    'a repository that caches the system tests of the modules "demo" and "other" by the rules of ADR 0081',
    async () => {
      await putCached(sut);
    },
  );

  await given('"turbo.json" gives "test:system" the inputs "$TURBO_DEFAULT$" and "!features/**"', async () => {
    await putCached(sut, { "turbo.json": cachedTurbo(TEST_GLOBALS, ["$TURBO_DEFAULT$", "!features/**"]) });
  });

  let run: Awaited<ReturnType<typeof runAffected>>;
  await when('the developer runs "osf check AFFECTED"', async () => {
    run = await runAffected(sut);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then(
    'the output contains "AFFECTED turbo.json:1 test:system must cache with the inputs ["$TURBO_DEFAULT$"], the outputs ["reports/**"] and the env ["OSF_TEST_RUN"]"',
    async () => {
      expect(run.stdout).toContain(
        'AFFECTED turbo.json:1 test:system must cache with the inputs ["$TURBO_DEFAULT$"], the outputs ["reports/**"] and the env ["OSF_TEST_RUN"]',
      );
    },
  );
});

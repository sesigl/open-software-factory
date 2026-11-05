import { scenario } from "@opensoftware/testkit";
import { putCached, runAffected } from "./affected.ts";
import { cachedTurbo, TEST_GLOBALS } from "./repo.ts";

scenario("SCN-REPO-082", async ({ sut, given, when, then }) => {
  await given(
    'a repository that caches the system tests of the modules "demo" and "other" by the rules of ADR 0081',
    async () => {
      await putCached(sut);
    },
  );

  await given('"turbo.json" sets no "cacheDir"', async () => {
    await putCached(sut, { "turbo.json": cachedTurbo(TEST_GLOBALS, ["$TURBO_DEFAULT$"], "") });
  });

  let run: Awaited<ReturnType<typeof runAffected>>;
  await when('the developer runs "osf check AFFECTED"', async () => {
    run = await runAffected(sut);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then(
    'the output contains "AFFECTED turbo.json:1 cacheDir must be ".turbo/cache": results hold absolute paths, so a worktree must not replay those of another"',
    async () => {
      expect(run.stdout).toContain(
        'AFFECTED turbo.json:1 cacheDir must be ".turbo/cache": results hold absolute paths, so a worktree must not replay those of another',
      );
    },
  );
});

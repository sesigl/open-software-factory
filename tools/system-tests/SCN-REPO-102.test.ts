import { scenario } from "@opensoftware/testkit";
import { putCached, runAffected } from "./affected.ts";
import { verifyWorkflow } from "./repo.ts";

scenario("SCN-REPO-102", async ({ sut, given, when, then }) => {
  await given(
    'a repository that caches the system tests of the modules "demo" and "other" by the rules of ADR 0081',
    async () => {
      await putCached(sut);
    },
  );

  await given(
    'the tests job of ".github/workflows/verify.yml" restores ".turbo/cache" from the cache "turbo-demo-"',
    async () => {
      await putCached(sut, { ".github/workflows/verify.yml": verifyWorkflow({ testsCache: "turbo-demo-" }) });
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
    'the output contains "AFFECTED .github/workflows/verify.yml:13 the job tests must keep .turbo/cache in the cache turbo-tests-"',
    async () => {
      expect(run.stdout).toContain(
        "AFFECTED .github/workflows/verify.yml:13 the job tests must keep .turbo/cache in the cache turbo-tests-",
      );
    },
  );
});

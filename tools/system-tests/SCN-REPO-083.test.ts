import { scenario } from "@opensoftware/testkit";
import { putCached, runAffected } from "./affected.ts";
import { VERIFY_TESTS } from "./repo.ts";

scenario("SCN-REPO-083", async ({ sut, given, when, then }) => {
  await given(
    'a repository that caches the system tests of the modules "demo" and "other" by the rules of ADR 0081',
    async () => {
      await putCached(sut);
    },
  );

  await given('the target "verify-tests" of "Makefile" runs "turbo run test:system --only"', async () => {
    await putCached(sut, { Makefile: VERIFY_TESTS.replace("test:system", "test:system --only") });
  });

  let run: Awaited<ReturnType<typeof runAffected>>;
  await when('the developer runs "osf check AFFECTED"', async () => {
    run = await runAffected(sut);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then(
    'the output contains "AFFECTED Makefile:2 runs test:system with --only, which leaves its dependencies out of the hash"',
    async () => {
      expect(run.stdout).toContain(
        "AFFECTED Makefile:2 runs test:system with --only, which leaves its dependencies out of the hash",
      );
    },
  );
});

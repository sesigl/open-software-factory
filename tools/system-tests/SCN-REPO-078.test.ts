import { scenario } from "@opensoftware/testkit";
import { putCached, runAffected } from "./affected.ts";

scenario("SCN-REPO-078", async ({ sut, given, when, then }) => {
  await given(
    'a repository that caches the system tests of the modules "demo" and "other" by the rules of ADR 0081',
    async () => {
      await putCached(sut);
    },
  );

  await given('the target "verify-tests" of "Makefile" runs the system tests without "OSF_TEST_RUN"', async () => {
    await putCached(sut, { Makefile: "verify-tests:\n\t@$(TURBO) test:system\n" });
  });

  let run: Awaited<ReturnType<typeof runAffected>>;
  await when('the developer runs "osf check AFFECTED"', async () => {
    run = await runAffected(sut);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then(
    'the output contains "AFFECTED Makefile:1 verify-tests must give each run its own test hash with $(if $(OSF_TEST_CACHE),,OSF_TEST_RUN=$$$$-$$(date +%s))"',
    async () => {
      expect(run.stdout).toContain(
        "AFFECTED Makefile:1 verify-tests must give each run its own test hash with $(if $(OSF_TEST_CACHE),,OSF_TEST_RUN=$$$$-$$(date +%s))",
      );
    },
  );
});

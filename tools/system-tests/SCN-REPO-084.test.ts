import { scenario } from "@opensoftware/testkit";
import { putCached, runAffected } from "./affected.ts";
import { VERIFY_TESTS } from "./repo.ts";

scenario("SCN-REPO-084", async ({ sut, given, when, then }) => {
  await given(
    'a repository that caches the system tests of the modules "demo" and "other" by the rules of ADR 0081',
    async () => {
      await putCached(sut);
    },
  );

  await given('the target "verify-static" of "Makefile" runs lint, typecheck and build without "--force"', async () => {
    await putCached(sut, { Makefile: VERIFY_TESTS.replace(" $(if $(OSF_TEST_CACHE),,--force)", "") });
  });

  let run: Awaited<ReturnType<typeof runAffected>>;
  await when('the developer runs "osf check AFFECTED"', async () => {
    run = await runAffected(sut);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then(
    'the output contains "AFFECTED Makefile:3 verify-static must run lint, typecheck and build with $(if $(OSF_TEST_CACHE),,--force)"',
    async () => {
      expect(run.stdout).toContain(
        "AFFECTED Makefile:3 verify-static must run lint, typecheck and build with $(if $(OSF_TEST_CACHE),,--force)",
      );
    },
  );
});

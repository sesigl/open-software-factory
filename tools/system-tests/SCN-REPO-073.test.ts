import { scenario } from "@opensoftware/testkit";
import { putCached, runAffected } from "./affected.ts";
import { verifyWorkflow } from "./repo.ts";

scenario("SCN-REPO-073", async ({ sut, given, when, then }) => {
  await given(
    'a repository that caches the system tests of the modules "demo" and "other" by the rules of ADR 0081',
    async () => {
      await putCached(sut);
    },
  );

  await given(
    'the tests job "rest" of ".github/workflows/verify.yml" has the filter "!@opensoftware/other"',
    async () => {
      await putCached(sut, { ".github/workflows/verify.yml": verifyWorkflow("!@opensoftware/other") });
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
    'the output contains "AFFECTED modules/demo/package.json:1 the tests jobs demo and rest of .github/workflows/verify.yml both run the system tests of @opensoftware/demo"',
    async () => {
      expect(run.stdout).toContain(
        "AFFECTED modules/demo/package.json:1 the tests jobs demo and rest of .github/workflows/verify.yml both run the system tests of @opensoftware/demo",
      );
    },
  );
});

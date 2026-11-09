import { scenario } from "@opensoftware/testkit";
import { putCached, runAffected } from "./affected.ts";
import { verifyWorkflow } from "./repo.ts";

scenario("SCN-REPO-100", async ({ sut, given, when, then }) => {
  await given(
    'a repository that caches the system tests of the modules "demo" and "other" by the rules of ADR 0081',
    async () => {
      await putCached(sut);
    },
  );

  await given(
    'the tests job of ".github/workflows/verify.yml" runs the suites "demo" and "rest" from its own matrix',
    async () => {
      await putCached(sut, {
        ".github/workflows/verify.yml": verifyWorkflow({ include: "[{ suite: demo }, { suite: rest }]" }),
      });
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
    'the output contains "AFFECTED .github/workflows/verify.yml:13 the tests job must run the suites of the job plan: include: ${{ fromJSON(needs.plan.outputs.suites) }}"',
    async () => {
      expect(run.stdout).toContain(
        "AFFECTED .github/workflows/verify.yml:13 the tests job must run the suites of the job plan: include: ${{ fromJSON(needs.plan.outputs.suites) }}",
      );
    },
  );
});

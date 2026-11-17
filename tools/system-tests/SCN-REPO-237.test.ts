import { scenario } from "@opensoftware/testkit";
import { checkRelease, dispatched, putModules, releaseFiles, releasePlease, start } from "./release.ts";
import { putAll } from "./repo.ts";

scenario("SCN-REPO-237", async ({ sut, given, when, then }) => {
  await given(
    'a repository with the published module "demo" at version "0.3.0" and the private module "other"',
    async () => {
      await putModules(sut);
    },
  );

  await given('the developer ran "osf release-files"', async () => {
    expect((await releaseFiles(sut)).exitCode).toBe(0);
  });

  await given(
    '".github/workflows/release-please.yml" starts "verify.yml" and "gatekeeper.yml" from main with "-f pr=", and only "verify.yml" takes the input "pr"',
    async () => {
      await putAll(sut, {
        ".github/workflows/release-please.yml": releasePlease(start("verify.yml"), start("gatekeeper.yml")),
        ".github/workflows/verify.yml": dispatched(),
        ".github/workflows/gatekeeper.yml": dispatched(false),
      });
    },
  );

  let run: Awaited<ReturnType<typeof checkRelease>>;
  await when('the developer runs "osf check RELEASE"', async () => {
    run = await checkRelease(sut);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then(
    'the output contains "RELEASE .github/workflows/gatekeeper.yml:1 has no workflow_dispatch input pr, which release-please.yml passes for each release pull request (ADR 0174)"',
    async () => {
      expect(run.stdout).toContain(
        "RELEASE .github/workflows/gatekeeper.yml:1 has no workflow_dispatch input pr, which release-please.yml passes for each release pull request (ADR 0174)",
      );
      expect(run.stdout).not.toContain("verify.yml:");
    },
  );
});

import { scenario } from "@opensoftware/testkit";
import { checkRelease, dispatched, putModules, releaseFiles, releasePlease, start } from "./release.ts";
import { putAll } from "./repo.ts";

scenario("SCN-REPO-236", async ({ sut, given, when, then }) => {
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
    '".github/workflows/release-please.yml" starts "verify.yml" from main and "gatekeeper.yml" from the release branch, both with "-f pr=" on line 9',
    async () => {
      await putAll(sut, {
        ".github/workflows/release-please.yml": releasePlease(
          start("gatekeeper.yml", '"$BRANCH"'),
          start("verify.yml"),
        ),
        ".github/workflows/verify.yml": dispatched(),
        ".github/workflows/gatekeeper.yml": dispatched(),
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
    'the output contains "RELEASE .github/workflows/release-please.yml:9 starts no gatekeeper.yml from main for each release pull request (gh workflow run gatekeeper.yml --ref main -f pr=<number>), so they miss the required status gatekeeper (ADR 0174)"',
    async () => {
      expect(run.stdout).toContain(
        "RELEASE .github/workflows/release-please.yml:9 starts no gatekeeper.yml from main for each release pull request (gh workflow run gatekeeper.yml --ref main -f pr=<number>), so they miss the required status gatekeeper (ADR 0174)",
      );
      expect(run.stdout).not.toContain("starts no verify.yml");
    },
  );
});

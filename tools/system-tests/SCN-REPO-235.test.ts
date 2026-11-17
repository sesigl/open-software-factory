import { scenario } from "@opensoftware/testkit";
import { checkRelease, dispatched, putModules, releaseFiles, releasePlease, start } from "./release.ts";
import { putAll } from "./repo.ts";

scenario("SCN-REPO-235", async ({ sut, given, when, then }) => {
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
    '".github/workflows/release-please.yml" starts "verify.yml" and "gatekeeper.yml" from main with "-f pr=", and both take the input "pr"',
    async () => {
      await putAll(sut, {
        ".github/workflows/release-please.yml": releasePlease(start("verify.yml"), start("gatekeeper.yml")),
        ".github/workflows/verify.yml": dispatched(),
        ".github/workflows/gatekeeper.yml": dispatched(),
      });
    },
  );

  let run: Awaited<ReturnType<typeof checkRelease>>;
  await when('the developer runs "osf check RELEASE"', async () => {
    run = await checkRelease(sut);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then('the output contains "RELEASE ok"', async () => {
    expect(run.stdout).toContain("RELEASE ok");
  });
});

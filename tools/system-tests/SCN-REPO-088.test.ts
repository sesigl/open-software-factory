import { scenario } from "@opensoftware/testkit";
import { checkRelease, putModules, releaseFiles } from "./release.ts";

scenario("SCN-REPO-088", async ({ sut, given, when, then }) => {
  await given(
    'a repository with the published module "demo" at version "0.3.0" and the private module "other"',
    async () => {
      await putModules(sut);
    },
  );

  await given('the developer ran "osf release-files"', async () => {
    expect((await releaseFiles(sut)).exitCode).toBe(0);
  });

  await given('".github/workflows/publish-demo.yml" gets one more line', async () => {
    await sut.files.put(
      `$INPUT/.github/workflows/publish-demo.yml`,
      `${await sut.files.read(`$INPUT/.github/workflows/publish-demo.yml`)}# one more line\n`,
    );
  });

  let run: Awaited<ReturnType<typeof checkRelease>>;
  await when('the developer runs "osf check RELEASE"', async () => {
    run = await checkRelease(sut);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then(
    'the output contains "RELEASE .github/workflows/publish-demo.yml:1 differs from tools/scaffold/publish-workflow.yml: run osf release-files"',
    async () => {
      expect(run.stdout).toContain(
        "RELEASE .github/workflows/publish-demo.yml:1 differs from tools/scaffold/publish-workflow.yml: run osf release-files",
      );
    },
  );
});

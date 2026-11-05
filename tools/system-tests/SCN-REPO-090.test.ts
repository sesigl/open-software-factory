import { scenario } from "@opensoftware/testkit";
import { checkRelease, manifest, putModules, releaseFiles } from "./release.ts";

scenario("SCN-REPO-090", async ({ sut, given, when, then }) => {
  await given(
    'a repository with the published module "demo" at version "0.3.0" and the private module "other"',
    async () => {
      await putModules(sut);
    },
  );

  await given('the developer ran "osf release-files"', async () => {
    expect((await releaseFiles(sut)).exitCode).toBe(0);
  });

  await given('"modules/demo/package.json" has the version "0.4.0"', async () => {
    await sut.files.put("$INPUT/modules/demo/package.json", manifest("demo", "0.4.0"));
  });

  let run: Awaited<ReturnType<typeof checkRelease>>;
  await when('the developer runs "osf check RELEASE"', async () => {
    run = await checkRelease(sut);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then(
    'the output contains "RELEASE .release-please-manifest.json:2 does not give modules/demo its version 0.4.0: run osf release-files"',
    async () => {
      expect(run.stdout).toContain(
        "RELEASE .release-please-manifest.json:2 does not give modules/demo its version 0.4.0: run osf release-files",
      );
    },
  );
});

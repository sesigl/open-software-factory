import { scenario } from "@opensoftware/testkit";
import { checkRelease, manifest, putModules, releaseFiles } from "./release.ts";

scenario("SCN-REPO-091", async ({ sut, given, when, then }) => {
  await given(
    'a repository with the published module "demo" at version "0.3.0" and the private module "other"',
    async () => {
      await putModules(sut);
    },
  );

  await given('the developer ran "osf release-files"', async () => {
    expect((await releaseFiles(sut)).exitCode).toBe(0);
  });

  await given('"modules/demo/package.json" is private', async () => {
    await sut.files.put("$INPUT/modules/demo/package.json", manifest("demo", "0.3.0", true));
  });

  let run: Awaited<ReturnType<typeof checkRelease>>;
  await when('the developer runs "osf check RELEASE"', async () => {
    run = await checkRelease(sut);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then(
    'the output contains "RELEASE .github/workflows/publish-demo.yml:1 publishes no published package of the workspace: run osf release-files"',
    async () => {
      expect(run.stdout).toContain(
        "RELEASE .github/workflows/publish-demo.yml:1 publishes no published package of the workspace: run osf release-files",
      );
    },
  );

  await then(
    'the output contains "RELEASE release-please-config.json:3 modules/demo is no published package: run osf release-files"',
    async () => {
      expect(run.stdout).toContain(
        "RELEASE release-please-config.json:3 modules/demo is no published package: run osf release-files",
      );
    },
  );
});

import { scenario } from "@opensoftware/testkit";
import { checkRelease, putModules, releaseFiles } from "./release.ts";

scenario("SCN-REPO-089", async ({ sut, given, when, then }) => {
  await given(
    'a repository with the published module "demo" at version "0.3.0" and the private module "other"',
    async () => {
      await putModules(sut);
    },
  );

  await given('the developer ran "osf release-files"', async () => {
    expect((await releaseFiles(sut)).exitCode).toBe(0);
  });

  await given('"release-please-config.json" has no packages', async () => {
    await sut.files.put("$INPUT/release-please-config.json", '{ "packages": {} }\n');
  });

  let run: Awaited<ReturnType<typeof checkRelease>>;
  await when('the developer runs "osf check RELEASE"', async () => {
    run = await checkRelease(sut);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then(
    'the output contains "RELEASE release-please-config.json:1 has no entry for modules/demo with"',
    async () => {
      expect(run.stdout).toContain("RELEASE release-please-config.json:1 has no entry for modules/demo with");
    },
  );
});

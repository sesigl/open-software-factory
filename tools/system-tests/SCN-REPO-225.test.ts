import { scenario } from "@opensoftware/testkit";
import { type Profile, putProfile, runProfile } from "./profile.ts";

scenario("SCN-REPO-225", async ({ sut, given, when, then }) => {
  const profile: Profile = { packageManager: "pnpm@10.28.0", args: { PNPM_VERSION: "10.28.0" } };
  await given(
    `a workspace whose Compose profile and Helm chart pin "demo" 0.2.0 and "adapter" 0.3.0 as osf profile-pins writes them, with "packageManager" "pnpm@10.28.0" in "package.json" and the build argument "PNPM_VERSION" "10.28.0" of the image of "demo"`,
    async () => {
      await putProfile(sut, profile);
    },
  );

  await given(`"packageManager" in "package.json" is "pnpm@10.29.0"`, async () => {
    Object.assign(profile, { packageManager: "pnpm@10.29.0" });
    await putProfile(sut, profile);
  });

  let run: Awaited<ReturnType<typeof runProfile>>;
  await when(`the developer runs "osf check PROFILE"`, async () => {
    run = await runProfile(sut);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout).toBe(1);
  });

  await then(
    `the output contains "PROFILE deploy/compose/compose.yaml:9 is not the released pin; osf profile-pins writes "PNPM_VERSION: "10.29.0"""`,
    async () => {
      expect(run.stdout).toContain(
        `PROFILE deploy/compose/compose.yaml:9 is not the released pin; osf profile-pins writes "PNPM_VERSION: "10.29.0""`,
      );
    },
  );

  await then(
    `the output contains "PROFILE deploy/compose/compose.yaml:5 is not the released pin; osf profile-pins writes "image: ghcr.io/sesigl/open-software-factory/demo:0.2.0-r1""`,
    async () => {
      expect(run.stdout).toContain(
        `PROFILE deploy/compose/compose.yaml:5 is not the released pin; osf profile-pins writes "image: ghcr.io/sesigl/open-software-factory/demo:0.2.0-r1"`,
      );
    },
  );
});

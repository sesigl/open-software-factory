import { scenario } from "@opensoftware/testkit";
import { type Profile, putProfile, runProfile } from "./profile.ts";

scenario("SCN-REPO-107", async ({ sut, given, when, then }) => {
  const profile: Profile = {};
  const base = "";
  await given(
    `a workspace whose Compose profile and Helm chart pin "demo" 0.2.0 and "adapter" 0.3.0 as osf profile-pins writes them`,
    async () => {
      await putProfile(sut, profile);
    },
  );

  await given(`the workspace's version of "adapter" is 0.3.1`, async () => {
    Object.assign(profile, { adapter: "0.3.1" });
    await putProfile(sut, profile);
  });

  let run: Awaited<ReturnType<typeof runProfile>>;
  await when(`the developer runs "osf check PROFILE"`, async () => {
    run = await runProfile(sut, base ? { OSF_BASE: base } : {});
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout).toBe(1);
  });

  await then(
    `the output contains "PROFILE deploy/compose/compose.yaml:8 is not the released pin; osf profile-pins writes "PACKAGES: "@opensoftware/demo@0.2.0 @opensoftware/adapter@0.3.1"""`,
    async () => {
      expect(run.stdout).toContain(
        `PROFILE deploy/compose/compose.yaml:8 is not the released pin; osf profile-pins writes "PACKAGES: "@opensoftware/demo@0.2.0 @opensoftware/adapter@0.3.1""`,
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

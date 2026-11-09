import { scenario } from "@opensoftware/testkit";
import { type Profile, putProfile, runProfile } from "./profile.ts";

scenario("SCN-REPO-119", async ({ sut, given, when, then }) => {
  const profile: Profile = { volume: true };
  let base = "";
  await given(
    `a base commit with a workspace whose Compose profile and Helm chart pin "demo" 0.2.0 and "adapter" 0.3.0 as osf profile-pins writes them, and the volume "demo"`,
    async () => {
      await putProfile(sut, profile);
      base = await sut.git.commit("base");
    },
  );

  await given(
    `a change that moves "adapter" to 0.3.1 in the workspace and in the image of "demo", with its tag unchanged`,
    async () => {
      Object.assign(profile, { adapter: "0.3.1", pins: "@opensoftware/demo@0.2.0 @opensoftware/adapter@0.3.1" });
      await putProfile(sut, profile);
    },
  );

  let run: Awaited<ReturnType<typeof runProfile>>;
  await when(`the developer runs "osf check PROFILE" against the base commit`, async () => {
    run = await runProfile(sut, { OSF_BASE: base });
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout).toBe(1);
  });

  await then(
    `the output contains "PROFILE deploy/compose/compose.yaml:4 the packages of the image demo changed, so its tag 0.2.0 must change too"`,
    async () => {
      expect(run.stdout).toContain(
        `PROFILE deploy/compose/compose.yaml:4 the packages of the image demo changed, so its tag 0.2.0 must change too`,
      );
    },
  );
});

import { scenario } from "@opensoftware/testkit";
import { type Profile, putProfile, runProfile } from "./profile.ts";

scenario("SCN-REPO-187", async ({ sut, given, when, then }) => {
  const profile: Profile = {};
  await given(
    `a workspace whose Compose profile and Helm chart pin "demo" 0.2.0 and "adapter" 0.3.0 as osf profile-pins writes them`,
    async () => {
      await putProfile(sut, profile);
    },
  );

  await given(`"deploy/package.json" declares "@opensoftware/demo" but not "@opensoftware/adapter"`, async () => {
    Object.assign(profile, { declares: ["demo"] });
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
    `the output contains "PROFILE deploy/package.json:1 does not declare @opensoftware/adapter, which deploy/compose/compose.yaml installs: the deploy suite builds its images from the workspace (ADR 0156)"`,
    async () => {
      expect(run.stdout).toContain(
        "PROFILE deploy/package.json:1 does not declare @opensoftware/adapter, which deploy/compose/compose.yaml installs: the deploy suite builds its images from the workspace (ADR 0156)",
      );
      expect(run.stdout).not.toContain("does not declare @opensoftware/demo");
    },
  );
});

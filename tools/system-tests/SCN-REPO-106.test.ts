import { scenario } from "@opensoftware/testkit";
import { type Profile, putProfile, runProfile } from "./profile.ts";

scenario("SCN-REPO-106", async ({ sut, given, when, then }) => {
  const profile: Profile = {};
  let base = "";
  await given(
    `a base commit with a workspace whose Compose profile and Helm chart pin "demo" 0.2.0 and "adapter" 0.3.0 as osf profile-pins writes them`,
    async () => {
      await putProfile(sut, profile);
      base = await sut.git.commit("base");
    },
  );

  let run: Awaited<ReturnType<typeof runProfile>>;
  await when(`the developer runs "osf check PROFILE" against the base commit`, async () => {
    run = await runProfile(sut, base ? { OSF_BASE: base } : {});
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout).toBe(0);
  });

  await then(`the output contains "PROFILE ok"`, async () => {
    expect(run.stdout).toContain(`PROFILE ok`);
  });
});

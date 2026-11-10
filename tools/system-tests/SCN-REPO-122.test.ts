import { scenario } from "@opensoftware/testkit";
import { type Profile, putProfile, runProfile } from "./profile.ts";

scenario("SCN-REPO-122", async ({ sut, given, when, then }) => {
  const profile: Profile = {};
  await given(
    `a workspace whose Compose profile and Helm chart pin "demo" 0.2.0 and "adapter" 0.3.0 as osf profile-pins writes them`,
    async () => {
      await putProfile(sut, profile);
    },
  );

  await given(
    `the Compose profile builds the image "litellm" with the tag 1.106.2, and the Helm chart's LiteLLM image is that image`,
    async () => {
      Object.assign(profile, { gateway: "1.106.2" });
      await putProfile(sut, profile);
    },
  );

  let run: Awaited<ReturnType<typeof runProfile>>;
  await when(`the developer runs "osf check PROFILE"`, async () => {
    run = await runProfile(sut);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout).toBe(0);
  });
});

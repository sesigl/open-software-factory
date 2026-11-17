import { scenario } from "@opensoftware/testkit";
import { type Profile, putProfile, runProfile } from "./profile.ts";

scenario("SCN-REPO-227", async ({ sut, given, when, then }) => {
  const profile: Profile = { packageManager: "pnpm@10.28.0", args: { PNPM_VERSION: "10.28.0" } };
  let base = "";
  await given(
    `a base commit with a workspace whose Compose profile and Helm chart pin "demo" 0.2.0 and "adapter" 0.3.0 as osf profile-pins writes them, with "packageManager" "pnpm@10.28.0" in "package.json" and the build argument "PNPM_VERSION" "10.28.0" of the image of "demo"`,
    async () => {
      await putProfile(sut, profile);
      base = await sut.git.commit("base");
    },
  );

  await given(
    `a change that moves "packageManager" and the build argument "PNPM_VERSION" to 10.29.0, with the tag of "demo" unchanged`,
    async () => {
      Object.assign(profile, { packageManager: "pnpm@10.29.0", args: { PNPM_VERSION: "10.29.0" } });
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
    `the output contains "PROFILE deploy/compose/compose.yaml:4 the build argument PNPM_VERSION of the image demo changed, so its tag 0.2.0 must change too"`,
    async () => {
      expect(run.stdout).toContain(
        `PROFILE deploy/compose/compose.yaml:4 the build argument PNPM_VERSION of the image demo changed, so its tag 0.2.0 must change too`,
      );
    },
  );
});

import { scenario } from "@opensoftware/testkit";
import { type Profile, putProfile, REGISTRY, runProfile } from "./profile.ts";

scenario("SCN-REPO-120", async ({ sut, given, when, then }) => {
  const profile: Profile = {};
  await given(
    `a workspace whose Compose profile and Helm chart pin "demo" 0.2.0 and "adapter" 0.3.0 as osf profile-pins writes them`,
    async () => {
      await putProfile(sut, profile);
    },
  );

  await given(
    `the reference factory names the template "ghcr.io/sesigl/open-software-factory/demo:0.1.0"`,
    async () => {
      Object.assign(profile, { template: `${REGISTRY}/demo:0.1.0` });
      await putProfile(sut, profile);
    },
  );

  let run: Awaited<ReturnType<typeof runProfile>>;
  await when(`the developer runs "osf check PROFILE"`, async () => {
    run = await runProfile(sut, {});
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout).toBe(1);
  });

  await then(
    `the output contains "PROFILE deploy/compose/factory/factory.yaml:4 is not the released pin; osf profile-pins writes "template: ghcr.io/sesigl/open-software-factory/demo:0.2.0""`,
    async () => {
      expect(run.stdout).toContain(
        `PROFILE deploy/compose/factory/factory.yaml:4 is not the released pin; osf profile-pins writes "template: ghcr.io/sesigl/open-software-factory/demo:0.2.0"`,
      );
    },
  );
});

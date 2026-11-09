import { scenario } from "@opensoftware/testkit";
import { type Profile, putProfile, REGISTRY } from "./profile.ts";

scenario("SCN-REPO-121", async ({ sut, given, when, then }) => {
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

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "osf profile-pins"', async () => {
    run = await sut.cli(["profile-pins"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then(`the reference factory names the template "ghcr.io/sesigl/open-software-factory/demo:0.2.0"`, async () => {
    const factory = await sut.files.read("$INPUT/deploy/compose/factory/factory.yaml");
    expect(factory).toContain(`template: ${REGISTRY}/demo:0.2.0\n`);
  });
});

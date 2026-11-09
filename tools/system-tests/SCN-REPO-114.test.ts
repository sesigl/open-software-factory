import { scenario } from "@opensoftware/testkit";
import { type Profile, putProfile, REGISTRY } from "./profile.ts";

scenario("SCN-REPO-114", async ({ sut, given, when, then }) => {
  const profile: Profile = {};
  await given(
    `a workspace whose Compose profile and Helm chart pin "demo" 0.2.0 and "adapter" 0.3.0 as osf profile-pins writes them`,
    async () => {
      await putProfile(sut, profile);
    },
  );

  await given(`the workspace's version of "demo" is 0.3.0`, async () => {
    Object.assign(profile, { demo: "0.3.0" });
    await putProfile(sut, profile);
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "osf profile-pins"', async () => {
    run = await sut.cli(["profile-pins"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then(
    `"deploy/compose/compose.yaml" pins the image "demo:0.3.0" with the packages "@opensoftware/demo@0.3.0 @opensoftware/adapter@0.3.0"`,
    async () => {
      const compose = await sut.files.read("$INPUT/deploy/compose/compose.yaml");
      expect(compose).toContain(`image: ${REGISTRY}/demo:0.3.0\n`);
      expect(compose).toContain(`PACKAGES: "@opensoftware/demo@0.3.0 @opensoftware/adapter@0.3.0"`);
    },
  );

  await then(`the Helm chart's tag of "demo" is "0.3.0" and its version is 0.1.1`, async () => {
    expect(await sut.files.read("$INPUT/deploy/helm/osf/values.yaml")).toContain(`  demo: "0.3.0"\n`);
    expect(await sut.files.read("$INPUT/deploy/helm/osf/Chart.yaml")).toContain("version: 0.1.1\n");
  });
});

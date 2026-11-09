import { scenario } from "@opensoftware/testkit";
import { type Profile, putProfile, runProfile } from "./profile.ts";

scenario("SCN-REPO-110", async ({ sut, given, when, then }) => {
  const profile: Profile = {};
  const base = "";
  await given(
    `a workspace whose Compose profile and Helm chart pin "demo" 0.2.0 and "adapter" 0.3.0 as osf profile-pins writes them`,
    async () => {
      await putProfile(sut, profile);
    },
  );

  await given(`the Helm chart's PostgreSQL image is "postgres:17-alpine"`, async () => {
    Object.assign(profile, { chartImage: "postgres:17-alpine" });
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
    `the output contains "PROFILE deploy/helm/osf/values.yaml:4 the image postgres:17-alpine is not an image of deploy/compose/compose.yaml"`,
    async () => {
      expect(run.stdout).toContain(
        `PROFILE deploy/helm/osf/values.yaml:4 the image postgres:17-alpine is not an image of deploy/compose/compose.yaml`,
      );
    },
  );
});

import { scenario } from "@opensoftware/testkit";
import { type Profile, putProfile, runProfile } from "./profile.ts";

scenario("SCN-REPO-111", async ({ sut, given, when, then }) => {
  const profile: Profile = {};
  const base = "";
  await given(
    `a workspace whose Compose profile and Helm chart pin "demo" 0.2.0 and "adapter" 0.3.0 as osf profile-pins writes them`,
    async () => {
      await putProfile(sut, profile);
    },
  );

  await given(`the suite "deploy" of ".github/test-suites.yml" pulls "nats:2.11.9-alpine"`, async () => {
    Object.assign(profile, { pull: "nats:2.11.9-alpine" });
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
    `the output contains "PROFILE .github/test-suites.yml:1 the suite deploy starts the image postgres:18-alpine but does not pull it"`,
    async () => {
      expect(run.stdout).toContain(
        `PROFILE .github/test-suites.yml:1 the suite deploy starts the image postgres:18-alpine but does not pull it`,
      );
    },
  );

  await then(
    `the output contains "PROFILE .github/test-suites.yml:1 the suite deploy pulls nats:2.11.9-alpine, which none of its packages names"`,
    async () => {
      expect(run.stdout).toContain(
        `PROFILE .github/test-suites.yml:1 the suite deploy pulls nats:2.11.9-alpine, which none of its packages names`,
      );
    },
  );
});

import { scenario } from "@opensoftware/testkit";
import { type Profile, putProfile, runProfile } from "./profile.ts";

scenario("SCN-REPO-116", async ({ sut, given, when, then }) => {
  const profile: Profile = {};
  await given(
    `a workspace whose Compose profile and Helm chart pin "demo" 0.2.0 and "adapter" 0.3.0 as osf profile-pins writes them`,
    async () => {
      await putProfile(sut, profile);
    },
  );

  await given(
    `the suite "deploy" of ".github/test-suites.yml" pulls "postgres:18-alpine chrislusf/seaweedfs:3.97", which only the testkit names`,
    async () => {
      Object.assign(profile, { pull: "postgres:18-alpine chrislusf/seaweedfs:3.97" });
      await putProfile(sut, profile);
    },
  );

  let run: Awaited<ReturnType<typeof runProfile>>;
  await when(`the developer runs "osf check PROFILE"`, async () => {
    run = await runProfile(sut);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout).toBe(1);
  });

  await then(
    `the output contains "PROFILE .github/test-suites.yml:1 the suite deploy pulls chrislusf/seaweedfs:3.97, which none of its packages names"`,
    async () => {
      expect(run.stdout).toContain(
        "PROFILE .github/test-suites.yml:1 the suite deploy pulls chrislusf/seaweedfs:3.97, which none of its packages names",
      );
    },
  );
});

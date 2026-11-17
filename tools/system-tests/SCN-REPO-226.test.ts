import { scenario } from "@opensoftware/testkit";
import { type Lychee, type Profile, putProfile, REGISTRY } from "./profile.ts";

const OLD: Lychee = { version: "0.20.1", x64: "1a".repeat(32), arm64: "2b".repeat(32) };
const NEW: Lychee = { version: "0.21.0", x64: "3c".repeat(32), arm64: "4d".repeat(32) };

scenario("SCN-REPO-226", async ({ sut, given, when, then }) => {
  const profile: Profile = {
    lychee: OLD,
    args: { LYCHEE_VERSION: OLD.version, LYCHEE_SHA256_AMD64: OLD.x64, LYCHEE_SHA256_ARM64: OLD.arm64 },
  };
  await given(
    `a workspace whose Compose profile and Helm chart pin "demo" 0.2.0 and "adapter" 0.3.0 as osf profile-pins writes them, with lychee 0.20.1 in "tools/scaffold/install-tools.ts" and the build arguments "LYCHEE_VERSION", "LYCHEE_SHA256_AMD64" and "LYCHEE_SHA256_ARM64" of the image of "demo" at its pins`,
    async () => {
      await putProfile(sut, profile);
    },
  );

  await given(
    `"tools/scaffold/install-tools.ts" pins lychee 0.21.0 with new SHA-256 sums for "linux-x64" and "linux-arm64"`,
    async () => {
      Object.assign(profile, { lychee: NEW });
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

  let compose = "";
  await then(
    `the image of "demo" has the build arguments "LYCHEE_VERSION" "0.21.0" and the new sums of "linux-x64" as "LYCHEE_SHA256_AMD64" and of "linux-arm64" as "LYCHEE_SHA256_ARM64"`,
    async () => {
      compose = await sut.files.read("$INPUT/deploy/compose/compose.yaml");
      const args = compose.split("\n").slice(8, 11);
      expect(args).toEqual([
        `        LYCHEE_VERSION: "${NEW.version}"`,
        `        LYCHEE_SHA256_AMD64: "${NEW.x64}"`,
        `        LYCHEE_SHA256_ARM64: "${NEW.arm64}"`,
      ]);
    },
  );

  await then(`"deploy/compose/compose.yaml" pins the image "demo:0.2.0-r1"`, async () => {
    expect(compose).toContain(`image: ${REGISTRY}/demo:0.2.0-r1\n`);
  });
});

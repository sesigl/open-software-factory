import { type CliResult, scenario } from "@opensoftware/testkit";

scenario("SCN-DIST-081", async ({ sut, fakes, given, when, then }) => {
  await given('the Compose profile "compose/compose.yaml"', async () => {
    expect(fakes.fromRepository("deploy/compose")["compose.yaml"]).toContain("services:");
  });

  let run: CliResult;
  await when('the operator runs "node scripts/images.ts --dry-run" with "OSF_DEPLOY_IMAGES=latest"', async () => {
    run = await sut.cli(["--dry-run"], { env: { OSF_DEPLOY_IMAGES: "latest" } });
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then(
    'the error output contains "images: OSF_DEPLOY_IMAGES is commit (the default) or released, not latest"',
    async () => {
      expect(run.stderr).toContain("images: OSF_DEPLOY_IMAGES is commit (the default) or released, not latest");
    },
  );
});

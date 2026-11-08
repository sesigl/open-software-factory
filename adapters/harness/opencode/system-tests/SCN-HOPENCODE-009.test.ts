import { type CliResult, scenario } from "@opensoftware/testkit";

scenario("SCN-HOPENCODE-009", async ({ sut, when, then }) => {
  let run: CliResult;
  await when('the developer runs "--help"', async () => {
    run = await sut.cli(["--help"]);
  });

  await then(
    'the command exits with code 0 and prints "harness-opencode run [--allow <kinds>]" and "harness-opencode transcript <session ID>"',
    async () => {
      expect(run.exitCode).toBe(0);
      expect(run.stdout).toContain("harness-opencode run [--allow <kinds>]");
      expect(run.stdout).toContain("harness-opencode transcript <session ID>");
    },
  );
});

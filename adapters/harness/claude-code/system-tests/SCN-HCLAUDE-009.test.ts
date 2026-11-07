import { type CliResult, scenario } from "@opensoftware/testkit";

scenario("SCN-HCLAUDE-009", async ({ sut, when, then }) => {
  let run: CliResult;
  await when('the developer runs "--help"', async () => {
    run = await sut.cli(["--help"]);
  });

  await then(
    'the command exits with code 0 and prints "harness-claude-code run [--allow <kinds>]" and "harness-claude-code transcript <session ID>"',
    async () => {
      expect(run.exitCode).toBe(0);
      expect(run.stdout).toContain("harness-claude-code run [--allow <kinds>]");
      expect(run.stdout).toContain("harness-claude-code transcript <session ID>");
    },
  );
});

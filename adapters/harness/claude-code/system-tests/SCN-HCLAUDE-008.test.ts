import { type CliResult, scenario } from "@opensoftware/testkit";

scenario("SCN-HCLAUDE-008", async ({ sut, when, then }) => {
  let run: CliResult;
  await when('the developer runs "run echo hi"', async () => {
    run = await sut.cli(["run", "echo", "hi"]);
  });

  await then(
    'the command exits with code 2 and writes "harness-claude-code: harness-claude-code run takes no agent command; it runs Claude Code" to standard error',
    async () => {
      expect(run.exitCode).toBe(2);
      expect(run.stderr).toContain(
        "harness-claude-code: harness-claude-code run takes no agent command; it runs Claude Code",
      );
    },
  );
});

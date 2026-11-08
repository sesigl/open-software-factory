import { type CliResult, scenario } from "@opensoftware/testkit";

scenario("SCN-HOPENCODE-008", async ({ sut, when, then }) => {
  let run: CliResult;
  await when('the developer runs "run echo hi"', async () => {
    run = await sut.cli(["run", "echo", "hi"]);
  });

  await then(
    'the command exits with code 2 and writes "harness-opencode: harness-opencode run takes no agent command; it runs opencode" to standard error',
    async () => {
      expect(run.exitCode).toBe(2);
      expect(run.stderr).toContain("harness-opencode: harness-opencode run takes no agent command; it runs opencode");
    },
  );
});

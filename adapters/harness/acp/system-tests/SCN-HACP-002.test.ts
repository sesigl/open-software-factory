import { type CliResult, scenario } from "@opensoftware/testkit";

scenario("SCN-HACP-002", async ({ sut, when, then }) => {
  let run: CliResult;
  await when('the developer runs "run" without an agent command', async () => {
    run = await sut.cli(["run"]);
  });

  await then(
    'the command exits with code 2 and writes "harness-acp: name the ACP agent to run after --" to standard error',
    async () => {
      expect(run.exitCode).toBe(2);
      expect(run.stderr).toBe("harness-acp: name the ACP agent to run after --\n");
    },
  );
});

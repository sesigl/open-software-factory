import { type CliResult, scenario } from "@opensoftware/testkit";

scenario("SCN-HOPENCODE-006", async ({ sut, when, then }) => {
  let run: CliResult;
  await when('the developer runs "run" without "OPENAI_MODEL"', async () => {
    run = await sut.cli(["run"]);
  });

  await then(
    'the command exits with code 2 and writes "harness-opencode: set OPENAI_MODEL to the model opencode calls" to standard error',
    async () => {
      expect(run.exitCode).toBe(2);
      expect(run.stderr).toContain("harness-opencode: set OPENAI_MODEL to the model opencode calls");
    },
  );
});

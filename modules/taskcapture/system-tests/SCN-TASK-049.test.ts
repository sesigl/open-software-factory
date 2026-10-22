import { scenario } from "@opensoftware/testkit";

scenario("SCN-TASK-049", async ({ sut, when, then }) => {
  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "taskcapture run --suite suite --model model-a"', async () => {
    run = await sut.cli(["run", "--suite", "suite", "--model", "model-a"]);
  });

  await then("the command exits with code 2", async () => {
    expect(run.exitCode).toBe(2);
  });

  await then(
    'the error output says "taskcapture: run takes --agent, like --agent claude-code or --agent oracle"',
    async () => {
      expect(run.stderr).toContain("taskcapture: run takes --agent, like --agent claude-code or --agent oracle");
    },
  );
});

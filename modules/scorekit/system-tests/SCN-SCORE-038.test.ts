import { scenario } from "@opensoftware/testkit";

scenario("SCN-SCORE-038", async ({ sut, when, then }) => {
  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "scorekit export --scorer redundant-tests --model claude-haiku-5-5"', async () => {
    run = await sut.cli(["export", "--scorer", "redundant-tests", "--model", "claude-haiku-5-5"]);
  });

  await then("the command exits with code 2", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(2);
  });

  await then('the error output says "--provider and --model go together"', async () => {
    expect(run.stderr).toContain("--provider and --model go together");
  });
});

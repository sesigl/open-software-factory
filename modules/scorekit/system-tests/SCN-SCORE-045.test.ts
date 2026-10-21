import { scenario } from "@opensoftware/testkit";

scenario("SCN-SCORE-045", async ({ sut, when, then }) => {
  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "scorekit export --push --scorer redundant-tests" without Langfuse keys', async () => {
    run = await sut.cli(["export", "--push", "--scorer", "redundant-tests"]);
  });

  await then("the command exits with code 2", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(2);
  });

  await then('the error output says "set LANGFUSE_PUBLIC_KEY and LANGFUSE_SECRET_KEY"', async () => {
    expect(run.stderr).toContain("set LANGFUSE_PUBLIC_KEY and LANGFUSE_SECRET_KEY");
  });
});

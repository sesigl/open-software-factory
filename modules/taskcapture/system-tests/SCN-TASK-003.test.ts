import { scenario } from "@opensoftware/testkit";

scenario("SCN-TASK-003", async ({ sut, when, then }) => {
  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "taskcapture bench"', async () => {
    run = await sut.cli(["bench"]);
  });

  await then("the command exits with code 2", async () => {
    expect(run.exitCode).toBe(2);
  });

  await then('the error output starts with "Usage: taskcapture <command>"', async () => {
    expect(run.stderr.startsWith("Usage: taskcapture <command>")).toBe(true);
  });
});

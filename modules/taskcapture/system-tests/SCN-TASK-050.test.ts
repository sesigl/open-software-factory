import { scenario } from "@opensoftware/testkit";

scenario("SCN-TASK-050", async ({ sut, given, when, then }) => {
  await given('an empty folder "suite"', async () => {
    await sut.files.put("$INPUT/suite/notes.md", "no task here\n");
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "taskcapture run --suite suite --agent oracle"', async () => {
    run = await sut.cli(["run", "--suite", "suite", "--agent", "oracle"]);
  });

  await then("the command exits with code 2", async () => {
    expect(run.exitCode).toBe(2);
  });

  await then('the error output says "taskcapture: suite holds no Harbor task (a folder with task.toml)"', async () => {
    expect(run.stderr).toContain("taskcapture: suite holds no Harbor task (a folder with task.toml)");
  });
});

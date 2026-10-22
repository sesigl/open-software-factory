import { scenario } from "@opensoftware/testkit";

scenario("SCN-TASK-029", async ({ sut, given, when, then }) => {
  await given('an empty folder "jobs"', async () => {
    await sut.files.put("$INPUT/jobs/README.md", "no trials yet\n");
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "taskcapture report jobs"', async () => {
    run = await sut.cli(["report", "jobs"]);
  });

  await then("the command exits with code 2", async () => {
    expect(run.exitCode).toBe(2);
  });

  await then(
    'the error output says "taskcapture: no Harbor trial result (result.json with trial_name) in jobs"',
    async () => {
      expect(run.stderr).toBe("taskcapture: no Harbor trial result (result.json with trial_name) in jobs\n");
    },
  );
});

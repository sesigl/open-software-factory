import { scenario } from "@opensoftware/testkit";

scenario("SCN-TASK-058", async ({ sut, given, when, then }) => {
  await given('a file "notes.json" that holds "{}"', async () => {
    await sut.files.put("$INPUT/notes.json", "{}\n");
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "taskcapture capture --git . --run notes.json"', async () => {
    run = await sut.cli(["capture", "--git", ".", "--run", "notes.json"]);
  });

  await then("the command exits with code 2", async () => {
    expect(run.exitCode).toBe(2);
  });

  await then(
    'the error output says "taskcapture: notes.json is not a run record (OTLP/JSON with an invoke_agent span)"',
    async () => {
      expect(run.stderr).toContain("taskcapture: notes.json is not a run record (OTLP/JSON with an invoke_agent span)");
    },
  );
});

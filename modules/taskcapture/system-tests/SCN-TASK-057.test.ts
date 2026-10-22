import { scenario } from "@opensoftware/testkit";
import { runRecord } from "./pulls.ts";

scenario("SCN-TASK-057", async ({ sut, given, when, then }) => {
  await given('a run record "run-1.json" of the run "run-1" that names no pull request', async () => {
    await sut.files.put("$INPUT/run-1.json", runRecord({ id: "run-1", pulls: [] }));
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "taskcapture capture --git . --run run-1.json"', async () => {
    run = await sut.cli(["capture", "--git", ".", "--run", "run-1.json"]);
  });

  await then("the command exits with code 2", async () => {
    expect(run.exitCode).toBe(2);
  });

  await then('the error output says "taskcapture: the run run-1 names no pull request"', async () => {
    expect(run.stderr.trim()).toBe("taskcapture: the run run-1 names no pull request");
  });
});

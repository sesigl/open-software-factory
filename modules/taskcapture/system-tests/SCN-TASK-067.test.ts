import { scenario } from "@opensoftware/testkit";

scenario("SCN-TASK-067", async ({ sut, when, then }) => {
  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "taskcapture report"', async () => {
    run = await sut.cli(["report"]);
  });

  await then("the command exits with code 2", async () => {
    expect(run.exitCode).toBe(2);
  });

  await then('the error output says "taskcapture: report takes Harbor job folders or result.json files"', async () => {
    expect(run.stderr).toBe("taskcapture: report takes Harbor job folders or result.json files\n");
  });
});

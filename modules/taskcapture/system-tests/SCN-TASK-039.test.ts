import { scenario } from "@opensoftware/testkit";

scenario("SCN-TASK-039", async ({ sut, when, then }) => {
  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "taskcapture capture --tests ( https://github.com/acme/web/pull/7"', async () => {
    run = await sut.cli(["capture", "--tests", "(", "https://github.com/acme/web/pull/7"]);
  });

  await then("the command exits with code 2", async () => {
    expect(run.exitCode).toBe(2);
  });

  await then('the error output says "taskcapture: --tests takes a regular expression, like ^checks/"', async () => {
    expect(run.stderr).toBe("taskcapture: --tests takes a regular expression, like ^checks/\n");
  });
});

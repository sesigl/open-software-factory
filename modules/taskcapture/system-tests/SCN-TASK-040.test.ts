import { scenario } from "@opensoftware/testkit";

scenario("SCN-TASK-040", async ({ sut, when, then }) => {
  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "taskcapture capture acme/web#7"', async () => {
    run = await sut.cli(["capture", "acme/web#7"]);
  });

  await then("the command exits with code 2", async () => {
    expect(run.exitCode).toBe(2);
  });

  await then(
    'the error output says "taskcapture: acme/web#7 is not a pull request URL like https://github.com/acme/web/pull/7"',
    async () => {
      expect(run.stderr).toBe(
        "taskcapture: acme/web#7 is not a pull request URL like https://github.com/acme/web/pull/7\n",
      );
    },
  );
});

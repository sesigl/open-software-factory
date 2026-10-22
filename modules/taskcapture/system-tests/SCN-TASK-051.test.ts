import { scenario } from "@opensoftware/testkit";

scenario("SCN-TASK-051", async ({ sut, when, then }) => {
  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "taskcapture run --suite suite --agent oracle --configuration ../v1"', async () => {
    run = await sut.cli(["run", "--suite", "suite", "--agent", "oracle", "--configuration", "../v1"]);
  });

  await then("the command exits with code 2", async () => {
    expect(run.exitCode).toBe(2);
  });

  await then(
    'the error output says "taskcapture: --configuration takes a name like v1, or v1=harbor.yaml with a Harbor config file"',
    async () => {
      expect(run.stderr).toContain(
        "taskcapture: --configuration takes a name like v1, or v1=harbor.yaml with a Harbor config file",
      );
    },
  );
});

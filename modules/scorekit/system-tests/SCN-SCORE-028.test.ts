import { scenario } from "@opensoftware/testkit";

scenario("SCN-SCORE-028", async ({ sut, when, then }) => {
  const pack = ["redundant-tests", "change-requested", "scope-creep", "skipped-checks", "needless-human-question"];
  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "scorekit scorers"', async () => {
    run = await sut.cli(["scorers"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then(
    'the output lists the scorers "redundant-tests", "change-requested", "scope-creep", "skipped-checks" and "needless-human-question"',
    async () => {
      const names = run.stdout
        .trim()
        .split("\n")
        .map((line) => line.split(/\s+/)[0]);
      expect(names.sort()).toEqual([...pack].sort());
    },
  );

  await then("each line shows the scorer's sampling rate and description", async () => {
    const line = /^[a-z-]+\s+(0(\.\d+)?|1)\s+\S.{9,}$/;
    expect(
      run.stdout
        .trim()
        .split("\n")
        .filter((one) => !line.test(one)),
    ).toEqual([]);
  });
});

import { scenario } from "@opensoftware/testkit";

scenario("SCN-SCORE-002", async ({ sut, when, then }) => {
  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "scorekit --help"', async () => {
    run = await sut.cli(["--help"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stderr).toBe(0);
  });

  await then('the output lists the commands "score", "calibrate", "report", "push" and "scorers"', async () => {
    for (const command of ["score", "calibrate", "report", "push", "scorers"])
      expect(run.stdout).toMatch(new RegExp(`^  ${command}\\b`, "m"));
  });
});

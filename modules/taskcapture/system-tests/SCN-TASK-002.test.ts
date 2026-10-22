import { scenario } from "@opensoftware/testkit";

scenario("SCN-TASK-002", async ({ sut, when, then }) => {
  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "taskcapture --help"', async () => {
    run = await sut.cli(["--help"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode).toBe(0);
  });

  await then('the output lists the commands "capture", "report" and "route"', async () => {
    for (const command of ["capture", "report", "route"]) expect(run.stdout).toMatch(new RegExp(`^  ${command} `, "m"));
  });
});

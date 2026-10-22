import { scenario } from "@opensoftware/testkit";

scenario("SCN-OBS-002", async ({ sut, when, then }) => {
  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "observer --help"', async () => {
    run = await sut.cli(["--help"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stderr).toBe(0);
  });

  await then('the output lists the commands "analyze", "propose" and "check"', async () => {
    for (const command of ["analyze", "propose", "check"])
      expect(run.stdout).toMatch(new RegExp(`^  ${command} `, "m"));
  });
});

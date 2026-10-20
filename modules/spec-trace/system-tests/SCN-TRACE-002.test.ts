import { scenario } from "@opensoftware/testkit";

scenario("SCN-TRACE-002", async ({ sut, when, then }) => {
  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "spec-trace --help"', async () => {
    run = await sut.cli(["--help"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode).toBe(0);
  });

  await then('the output lists the commands "check", "report" and "next-id"', async () => {
    for (const command of ["check", "report", "next-id"]) expect(run.stdout).toMatch(new RegExp(`^  ${command} `, "m"));
  });
});

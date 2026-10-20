import { scenario } from "@opensoftware/testkit";

scenario("SCN-RUN-002", async ({ sut, when, then }) => {
  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "runlog --help"', async () => {
    run = await sut.cli(["--help"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stderr).toBe(0);
  });

  await then('the output lists the command "export"', async () => {
    expect(run.stdout).toMatch(/^Commands:\n\s+export /m);
  });
});

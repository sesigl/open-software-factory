import { scenario } from "@opensoftware/testkit";

scenario("SCN-RUN-061", async ({ sut, when, then }) => {
  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "runlog export"', async () => {
    run = await sut.cli(["export"]);
  });

  await then("the command exits with code 2", async () => {
    expect(run.exitCode, run.stderr).toBe(2);
  });

  await then('the error output lists the command "export"', async () => {
    expect(run.stderr).toMatch(/^Commands:\n\s+export /m);
  });
});

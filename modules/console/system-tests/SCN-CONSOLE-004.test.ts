import { scenario } from "@opensoftware/testkit";

scenario("SCN-CONSOLE-004", async ({ sut, when, then }) => {
  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "console serve" without "CONSOLE_FOREMAN_URL"', async () => {
    run = await sut.cli(["serve"], { env: { CONSOLE_FOREMAN_URL: "" } });
  });

  await then("the command exits with code 2", async () => {
    expect(run.exitCode).toBe(2);
  });

  await then('the output contains "set CONSOLE_FOREMAN_URL"', async () => {
    expect(run.stderr).toContain("set CONSOLE_FOREMAN_URL: the base URL of the foreman's API");
  });
});

import { scenario } from "@opensoftware/testkit";

scenario("SCN-CONSOLE-067", async ({ sut, given, when, then }) => {
  await given('a console without "CONSOLE_MODEL_URL" and "CONSOLE_HARNESS_COMMAND"', async () => {});

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "console doctor --deep"', async () => {
    run = await sut.cli(["doctor", "--deep"], { env: {} });
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode).toBe(1);
  });

  await then('it prints "FAIL  model: set CONSOLE_MODEL_URL to the gateway\'s base URL"', async () => {
    expect(run.stdout).toContain("FAIL  model: set CONSOLE_MODEL_URL to the gateway's base URL\n");
  });

  await then(
    'it prints "FAIL  harness: set CONSOLE_HARNESS_COMMAND to the command that starts the harness"',
    async () => {
      expect(run.stdout).toContain(
        "FAIL  harness: set CONSOLE_HARNESS_COMMAND to the command that starts the harness\n",
      );
    },
  );
});

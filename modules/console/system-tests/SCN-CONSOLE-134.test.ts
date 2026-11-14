import { scenario } from "@opensoftware/testkit";

scenario("SCN-CONSOLE-134", async ({ sut, given, when, then }) => {
  await given('a console without "CONSOLE_NATS_URL"', async () => {});

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "console doctor --deep"', async () => {
    run = await sut.cli(["doctor", "--deep"]);
  });

  await then("it prints no line about the events", async () => {
    expect(run.stdout, run.stderr).not.toMatch(/events/);
  });
});

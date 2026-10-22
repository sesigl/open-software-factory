import { scenario } from "@opensoftware/testkit";

scenario("SCN-OBS-003", async ({ sut, when, then }) => {
  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "observer improve"', async () => {
    run = await sut.cli(["improve"]);
  });

  await then("the command exits with code 2", async () => {
    expect(run.exitCode).toBe(2);
  });

  await then('the error output starts with "Usage: observer <command>"', async () => {
    expect(run.stderr.startsWith("Usage: observer <command>")).toBe(true);
  });
});

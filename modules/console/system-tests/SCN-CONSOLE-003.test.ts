import { scenario } from "@opensoftware/testkit";

scenario("SCN-CONSOLE-003", async ({ sut, when, then }) => {
  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "console show"', async () => {
    run = await sut.cli(["show"]);
  });

  await then("the command exits with code 2", async () => {
    expect(run.exitCode).toBe(2);
  });

  await then('the output contains "Usage: console <command>"', async () => {
    expect(run.stderr).toContain("Usage: console <command>");
  });
});

import { scenario } from "@opensoftware/testkit";

scenario("SCN-GATE-003", async ({ sut, when, then }) => {
  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "gatekeeper approve"', async () => {
    run = await sut.cli(["approve"]);
  });

  await then("the command exits with code 2", async () => {
    expect(run.exitCode).toBe(2);
  });

  await then('the error output starts with "Usage: gatekeeper <command>"', async () => {
    expect(run.stderr.startsWith("Usage: gatekeeper <command>")).toBe(true);
  });
});

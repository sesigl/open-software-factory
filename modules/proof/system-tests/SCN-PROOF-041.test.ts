import { scenario } from "@opensoftware/testkit";

scenario("SCN-PROOF-041", async ({ sut, when, then }) => {
  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "proof capture http://127.0.0.1:9/checkout"', async () => {
    run = await sut.cli(["capture", "http://127.0.0.1:9/checkout"]);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then('the error output contains "give the scenario with --scenario"', async () => {
    expect(run.stderr).toContain("give the scenario with --scenario");
  });
});

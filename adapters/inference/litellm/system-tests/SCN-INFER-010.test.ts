import { scenario } from "@opensoftware/testkit";

scenario("SCN-INFER-010", async ({ sut, when, then }) => {
  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the client runs "key 0123456789ab run-7 --budget ten"', async () => {
    run = await sut.cli(["key", "0123456789ab", "run-7", "--budget", "ten"]);
  });

  await then('key exits with code 2 and prints "--budget takes an amount in USD"', async () => {
    expect(run.exitCode).toBe(2);
    expect(run.stderr).toContain("--budget takes an amount in USD");
  });
});

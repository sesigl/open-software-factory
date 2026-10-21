import { scenario } from "@opensoftware/testkit";

scenario("SCN-RUN-062", async ({ sut, when, then }) => {
  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "runlog export missing.jsonl"', async () => {
    run = await sut.cli(["export", "missing.jsonl"]);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode).toBe(1);
  });

  await then('the error output starts with "runlog: cannot read missing.jsonl"', async () => {
    expect(run.stderr).toMatch(/^runlog: cannot read missing\.jsonl/);
  });
});

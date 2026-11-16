import { scenario } from "@opensoftware/testkit";

scenario("SCN-TK-196", async ({ sut, when, then }) => {
  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when(
    'the developer runs "testkit timed" on a command that waits half a second and exits with code 3',
    async () => {
      run = await sut.cli(["timed", "node", "-e", "setTimeout(() => process.exit(3), 500)"]);
    },
  );

  await then("the command exits with code 3", async () => {
    expect(run.exitCode, run.stderr).toBe(3);
  });

  await then('"reports/run-time.json" has the seconds from the command\'s start to its end, at least 0.5', async () => {
    const { seconds } = JSON.parse(await sut.files.read("$INPUT/reports/run-time.json")) as { seconds: number };
    expect(seconds).toBeGreaterThanOrEqual(0.5);
    expect(seconds).toBeLessThan(60);
    expect(run.stderr).toContain(`node took ${seconds} s of wall time`);
  });
});

import { scenario } from "@opensoftware/testkit";

scenario("SCN-TK-197", async ({ sut, when, then }) => {
  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when(
    'the developer runs "testkit timed node -e process.exit(0)" without the environment variable "CI"',
    async () => {
      run = await sut.cli(["timed", "node", "-e", "process.exit(0)"]);
    },
  );

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stderr).toBe(0);
  });

  await then('"reports/run-time.json" has the seconds from the command\'s start to its end', async () => {
    const { seconds } = JSON.parse(await sut.files.read("$INPUT/reports/run-time.json")) as { seconds: number };
    expect(seconds).toBeGreaterThan(0);
    expect(seconds).toBeLessThan(60);
  });
});

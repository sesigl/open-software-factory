import { scenario } from "@opensoftware/testkit";

scenario("SCN-TK-139", async ({ sut, given, when, then }) => {
  let env: Record<string, string> = {};
  await given('the environment variable "CI" is set to "true"', async () => {
    env = { CI: "true" };
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "testkit timed node -e process.exit(3)"', async () => {
    run = await sut.cli(["timed", "node", "-e", "process.exit(3)"], { env });
  });

  await then("the command exits with code 3", async () => {
    expect(run.exitCode, run.stderr).toBe(3);
  });

  await then(
    '"reports/runner-speed.json" has two benchmark times in milliseconds, the reference time and the slowdown',
    async () => {
      const speed = JSON.parse(await sut.files.read("$INPUT/reports/runner-speed.json")) as {
        benchmarkMs: number[];
        referenceMs: number;
        slowdown: number;
      };
      expect(speed.benchmarkMs).toHaveLength(2);
      for (const ms of speed.benchmarkMs) expect(ms).toBeGreaterThan(0);
      const mean = speed.benchmarkMs.reduce((sum, ms) => sum + ms, 0) / speed.benchmarkMs.length;
      expect(speed.slowdown).toBeCloseTo(mean / speed.referenceMs, 2);
    },
  );
});

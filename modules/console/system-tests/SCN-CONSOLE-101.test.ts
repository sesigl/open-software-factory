import { scenario } from "@opensoftware/testkit";

scenario("SCN-CONSOLE-101", async ({ sut, fakes, given, when, then }) => {
  let env: Record<string, string> = {};
  await given(
    'a collector at "CONSOLE_OTLP_URL" that takes the span but whose trace store at "CONSOLE_TRACES_URL" keeps none',
    async () => {
      const store = await fakes.traceStore({ keep: false });
      env = { CONSOLE_OTLP_URL: store.otlpUrl, CONSOLE_TRACES_URL: store.queryUrl };
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "console doctor --deep"', async () => {
    run = await sut.cli(["doctor", "--deep"], { env });
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then(
    'it prints "FAIL  traces: the span did not reach the trace store in 5 s: check the collector\'s exporter and CONSOLE_TRACES_URL"',
    async () => {
      expect(run.stdout).toContain(
        "FAIL  traces: the span did not reach the trace store in 5 s: check the collector's exporter and CONSOLE_TRACES_URL\n",
      );
    },
  );
});

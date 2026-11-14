import { scenario } from "@opensoftware/testkit";

scenario("SCN-CONSOLE-102", async ({ sut, fakes, given, when, then }) => {
  let env: Record<string, string> = {};
  await given(
    '"CONSOLE_OTLP_URL" names a port where nothing listens and "CONSOLE_TRACES_URL" names a trace store',
    async () => {
      const store = await fakes.traceStore();
      env = { CONSOLE_OTLP_URL: "http://127.0.0.1:1", CONSOLE_TRACES_URL: store.queryUrl };
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
    'it prints "FAIL  traces: no collector took the span: check CONSOLE_OTLP_URL and that the collector runs"',
    async () => {
      expect(run.stdout).toContain(
        "FAIL  traces: no collector took the span: check CONSOLE_OTLP_URL and that the collector runs\n",
      );
    },
  );
});

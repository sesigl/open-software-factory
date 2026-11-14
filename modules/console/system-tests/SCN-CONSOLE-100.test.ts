import { scenario } from "@opensoftware/testkit";

scenario("SCN-CONSOLE-100", async ({ sut, fakes, given, when, then }) => {
  let store: Awaited<ReturnType<typeof fakes.traceStore>>;
  let env: Record<string, string> = {};
  await given(
    'a trace store that takes OTLP at "CONSOLE_OTLP_URL" and answers Jaeger\'s query API at "CONSOLE_TRACES_URL"',
    async () => {
      store = await fakes.traceStore();
      env = { CONSOLE_OTLP_URL: store.otlpUrl, CONSOLE_TRACES_URL: store.queryUrl };
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "console doctor --deep"', async () => {
    run = await sut.cli(["doctor", "--deep"], { env });
  });

  await then('it prints "ok    traces"', async () => {
    expect(run.stdout, run.stderr).toMatch(/^ok {4}traces$/m);
  });

  await then('the trace store received one span "console doctor" of the service "console"', async () => {
    expect(store.spans()).toEqual([
      {
        traceId: expect.stringMatching(/^[0-9a-f]{32}$/),
        spanId: expect.stringMatching(/^[0-9a-f]{16}$/),
        name: "console doctor",
        service: "console",
      },
    ]);
  });

  await then("the console asked the trace store for that span's trace", async () => {
    // The fake answers Jaeger's query only for a trace it holds, so "ok" above needs the span's own trace ID.
    expect(run.stdout).not.toContain("FAIL  traces");
  });
});

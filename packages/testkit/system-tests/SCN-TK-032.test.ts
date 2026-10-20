import { scenario } from "@opensoftware/testkit";
import { collectorConfig, demoModule, WORK_SPAN } from "./module.ts";

const DROP = collectorConfig(["filter:", "  traces:", "    span:", "      - 'name == \"work\"'"]);

scenario("SCN-TK-032", async ({ sut, given, when, then }) => {
  let module: Record<string, string> = {};
  await given('a module whose CLI prints a Collector config that drops the span "work"', async () => {
    module = demoModule({
      bin: `process.stdout.write(${JSON.stringify(DROP)});\n`,
      steps: [
        'When the user sends the span "work" to a Collector with the config "demo" prints',
        "Then the Collector exports one request",
      ],
      test: [
        "let collector: Awaited<ReturnType<typeof fakes.collector>>;",
        'await when(\'the user sends the span "work" to a Collector with the config "demo" prints\', async () => {',
        "  collector = await fakes.collector((await sut.cli([])).stdout);",
        `  await collector.send(${JSON.stringify(WORK_SPAN)});`,
        "});",
        "await then('the Collector exports one request', async () => {",
        "  expect(await collector.exported({ timeoutMs: 1000 })).toHaveLength(1);",
        "});",
      ],
    });
  });

  await given(
    'its system test sends the span "work" to fakes.collector and expects one export within 1000 ms',
    async () => {
      for (const [path, content] of Object.entries(module)) await sut.files.put(path, content);
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "testkit run --junit report.xml" in the module', async () => {
    run = await sut.cli(["run", "--junit", "report.xml"]);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then('the output contains "expected 1 export(s) from the Collector, got 0"', async () => {
    expect(run.stdout + run.stderr).toContain("expected 1 export(s) from the Collector, got 0");
  });

  await then('the output contains "Collector log:"', async () => {
    expect(run.stdout + run.stderr).toContain("Collector log:");
  });
});

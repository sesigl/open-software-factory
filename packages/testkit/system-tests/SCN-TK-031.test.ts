import { scenario } from "@opensoftware/testkit";
import { collectorConfig, demoModule, testCases, WORK_SPAN } from "./module.ts";

scenario("SCN-TK-031", async ({ sut, given, when, then }) => {
  let module: Record<string, string> = {};
  await given('a module whose CLI prints a Collector config that renames the span "work" to "done"', async () => {
    module = demoModule({
      bin: `process.stdout.write(${JSON.stringify(collectorConfig(["transform:", "  trace_statements:", "    - context: span", "      statements:", '        - set(name, "done") where name == "work"']))});\n`,
      steps: [
        'When the user sends the span "work" to a Collector with the config "demo" prints',
        'Then the Collector exports the span "done"',
      ],
      test: [
        "let exported: unknown[] = [];",
        'await when(\'the user sends the span "work" to a Collector with the config "demo" prints\', async () => {',
        "  const collector = await fakes.collector((await sut.cli([])).stdout);",
        `  await collector.send(${JSON.stringify(WORK_SPAN)});`,
        "  exported = await collector.exported();",
        "});",
        "await then('the Collector exports the span \"done\"', async () => {",
        '  expect(JSON.stringify(exported)).toContain(\'"name":"done"\');',
        "});",
      ],
    });
  });

  await given(
    'its system test starts fakes.collector with that config, sends the span "work" and expects the exported span "done"',
    async () => {
      for (const [path, content] of Object.entries(module)) await sut.files.put(path, content);
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "testkit run --junit report.xml" in the module', async () => {
    run = await sut.cli(["run", "--junit", "report.xml"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then('"report.xml" has the passed test case "SCN-DEMO-001"', async () => {
    expect(testCases(await sut.files.read("$INPUT/report.xml"))).toContainEqual({
      name: "SCN-DEMO-001",
      failed: false,
    });
  });
});

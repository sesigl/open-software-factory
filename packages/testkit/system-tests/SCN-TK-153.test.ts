import { scenario } from "@opensoftware/testkit";
import { demoModule, testCases } from "./module.ts";

/** One scenario of the demo module: it runs the CLI on the namespace of its fakes.temporal. */
function demoScenario(id: string, last: string[]): string[] {
  return [
    `scenario("${id}", async ({ sut, fakes, when, then }) => {`,
    "  const temporal = await fakes.temporal();",
    "  let run: Awaited<ReturnType<typeof sut.cli>>;",
    "  await when('the user runs \"demo\"', async () => {",
    "    run = await sut.cli([], {",
    "      env: { DEMO_TEMPORAL_HTTP: temporal.httpUrl, DEMO_TEMPORAL_NAMESPACE: temporal.namespace },",
    "    });",
    "  });",
    "  await then('the output is the namespace', async () => {",
    "    expect(run.stdout, run.stderr).toBe(temporal.namespace);",
    ...last.map((line) => `    ${line}`),
    "  });",
    "});",
  ];
}

scenario("SCN-TK-153", async ({ sut, given, when, then }) => {
  let module: Record<string, string> = {};
  await given(
    'a module whose CLI reads the namespace "DEMO_TEMPORAL_NAMESPACE" from the Temporal HTTP API at "DEMO_TEMPORAL_HTTP" and prints its name',
    async () => {
      module = demoModule({
        bin: [
          "const { DEMO_TEMPORAL_HTTP: http, DEMO_TEMPORAL_NAMESPACE: namespace } = process.env;",
          "const response = await fetch(`${http}/api/v1/namespaces/${namespace}`);",
          "const body = await response.json();",
          "process.stdout.write(body.namespaceInfo?.name ?? `status ${response.status}`);",
          "",
        ].join("\n"),
        readme: [
          "# demo",
          "",
          "## Configuration",
          "",
          "| Variable | Meaning |",
          "| --- | --- |",
          "| `DEMO_TEMPORAL_HTTP` | Temporal HTTP API URL. |",
          "| `DEMO_TEMPORAL_NAMESPACE` | Temporal namespace. |",
          "",
        ].join("\n"),
      });
    },
  );

  let first: string[] = [];
  await given(
    "its two scenarios in one test file each pass the HTTP URL and the namespace of fakes.temporal and expect that namespace as the output",
    async () => {
      first = demoScenario("SCN-DEMO-001", ["address = temporal.address;", "namespace = temporal.namespace;"]);
    },
  );

  await given("its second scenario expects the address of the first and another namespace", async () => {
    const steps = ['    When the user runs "demo"', "    Then the output is the namespace"];
    const files = {
      ...module,
      "$INPUT/features/a.feature": [
        "Feature: Demo",
        "",
        ...["SCN-DEMO-001", "SCN-DEMO-002"].flatMap((id) => [
          `  @id=${id} @status=implemented`,
          `  Scenario: Demo ${id}`,
          ...steps,
          "",
        ]),
      ].join("\n"),
      "$INPUT/system-tests/SCN-DEMO-001.test.ts": [
        'import { scenario } from "@opensoftware/testkit";',
        "",
        'let address = "";',
        'let namespace = "";',
        ...first,
        ...demoScenario("SCN-DEMO-002", [
          "expect(temporal.address).toBe(address);",
          "expect(temporal.namespace).not.toBe(namespace);",
        ]),
        "",
      ].join("\n"),
    };
    for (const [path, content] of Object.entries(files)) await sut.files.put(path, content);
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "testkit run --junit report.xml" in the module', async () => {
    run = await sut.cli(["run", "--junit", "report.xml"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then('"report.xml" has the passed test cases "SCN-DEMO-001" and "SCN-DEMO-002"', async () => {
    const cases = testCases(await sut.files.read("$INPUT/report.xml"));
    expect(cases).toContainEqual({ name: "SCN-DEMO-001", failed: false });
    expect(cases).toContainEqual({ name: "SCN-DEMO-002", failed: false });
  });
});

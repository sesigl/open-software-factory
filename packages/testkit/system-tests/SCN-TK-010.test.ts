import { scenario } from "@opensoftware/testkit";
import { demoModule, testCases } from "./module.ts";

scenario("SCN-TK-010", async ({ sut, given, when, then }) => {
  let module: Record<string, string> = {};
  await given(
    'a module whose CLI reads the namespace "default" from the Temporal HTTP API at "DEMO_TEMPORAL_HTTP" and prints its name',
    async () => {
      module = demoModule({
        bin: [
          "const response = await fetch(`${process.env.DEMO_TEMPORAL_HTTP}/api/v1/namespaces/default`);",
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
          "",
        ].join("\n"),
        steps: ['When the user runs "demo"', 'Then the output is "default"'],
        test: [
          "const temporal = await fakes.temporal();",
          "let run: Awaited<ReturnType<typeof sut.cli>>;",
          "await when('the user runs \"demo\"', async () => {",
          "  run = await sut.cli([], { env: { DEMO_TEMPORAL_HTTP: temporal.httpUrl } });",
          "});",
          'await then("the output is \\"default\\"", async () => {',
          '  expect(run.stdout).toBe("default");',
          "});",
        ],
      });
    },
  );

  await given('its system test passes the HTTP URL of fakes.temporal and expects the output "default"', async () => {
    for (const [path, content] of Object.entries(module)) await sut.files.put(path, content);
  });

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

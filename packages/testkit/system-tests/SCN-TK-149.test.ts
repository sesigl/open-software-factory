import { scenario } from "@opensoftware/testkit";
import { demoModule, testCases } from "./module.ts";

const TRACE = "4bf92f3577b34da6a3ce929d0e0e4736";

/** The demo CLI: one span by OTLP/HTTP JSON, then Jaeger's answer for its trace as `<status> <body>`. */
const BIN = `const span = { traceId: "${TRACE}", spanId: "00f067aa0ba902b7", name: "ping" };
const resource = { attributes: [{ key: "service.name", value: { stringValue: "demo" } }] };
const sent = await fetch(process.env.DEMO_OTLP_URL + "/v1/traces", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ resourceSpans: [{ resource, scopeSpans: [{ spans: [span] }] }] }),
});
const answer = await fetch(process.env.DEMO_TRACES_URL + "/api/traces/${TRACE}");
process.stdout.write(sent.status + " " + answer.status + " " + (await answer.text()));
`;

scenario("SCN-TK-149", async ({ sut, given, when, then }) => {
  let module: Record<string, string> = {};
  await given(
    'a module whose CLI sends the span "ping" of the service "demo" by OTLP/HTTP to "DEMO_OTLP_URL" and prints Jaeger\'s answer at "DEMO_TRACES_URL"',
    async () => {
      module = demoModule({
        bin: BIN,
        readme: [
          "# demo",
          "",
          "## Configuration",
          "",
          "| Variable | Meaning |",
          "| --- | --- |",
          "| `DEMO_OTLP_URL` | OTLP/HTTP base URL. |",
          "| `DEMO_TRACES_URL` | Base URL of the trace store's query API. |",
          "",
        ].join("\n"),
        steps: [
          "When the user sends a span to each trace store",
          'Then the store that keeps spans answers with the span "ping" and the other with 404',
        ],
        test: [
          "const runs: string[] = [];",
          "const stores: Awaited<ReturnType<typeof fakes.traceStore>>[] = [];",
          "await when('the user sends a span to each trace store', async () => {",
          "  for (const store of [await fakes.traceStore(), await fakes.traceStore({ keep: false })]) {",
          "    stores.push(store);",
          "    const env = { DEMO_OTLP_URL: store.otlpUrl, DEMO_TRACES_URL: store.queryUrl };",
          "    runs.push((await sut.cli([], { env })).stdout);",
          "  }",
          "});",
          "await then('the store that keeps spans answers with the span \"ping\" and the other with 404', async () => {",
          `  const trace = { traceID: "${TRACE}", spans: [{ traceID: "${TRACE}", spanID: "00f067aa0ba902b7", operationName: "ping", processID: "p1" }], processes: { p1: { serviceName: "demo", tags: [] } } };`,
          '  expect(runs[0]).toBe("200 200 " + JSON.stringify({ data: [trace] }));',
          `  expect(runs[1]).toBe('200 404 {"data":null,"errors":[{"code":404,"msg":"trace not found"}]}');`,
          `  const span = { traceId: "${TRACE}", spanId: "00f067aa0ba902b7", name: "ping", service: "demo" };`,
          "  expect(stores.map((store) => store.spans())).toEqual([[span], [span]]);",
          "});",
        ],
      });
    },
  );

  await given(
    'its system test expects the span "ping" from fakes.traceStore and the status 404 from fakes.traceStore with "keep: false"',
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

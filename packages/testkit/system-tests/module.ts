// Text builders for the small modules the system tests create. They only build strings; the tests put them into
// $INPUT through sut.files.

export interface DemoOptions {
  /** The module's CLI, plain JavaScript. */
  bin?: string;
  /** README.md of the module. */
  readme?: string;
  /** Steps of SCN-DEMO-001, one Gherkin line each. */
  steps?: string[];
  /** Body of the test of SCN-DEMO-001; the context gives `sut`, `fakes`, `given`, `when` and `then`. */
  test?: string[];
  /** A library: package.json has no bin and there is no CLI. */
  library?: boolean;
}

const HELLO: Required<Pick<DemoOptions, "bin" | "steps" | "test">> = {
  bin: 'process.stdout.write("hello\\n");\n',
  steps: ['When the user runs "demo"', 'Then the output is "hello"'],
  test: [
    "let run: Awaited<ReturnType<typeof sut.cli>>;",
    "await when('the user runs \"demo\"', async () => {",
    "  run = await sut.cli([]);",
    "});",
    "await then('the output is \"hello\"', async () => {",
    '  expect(run.stdout).toBe("hello\\n");',
    "});",
  ],
};

/**
 * The files of module demo with the implemented scenario SCN-DEMO-001 and its system test, keyed by their path
 * below $INPUT. Without options, the CLI prints "hello" and the test expects it.
 */
export function demoModule(options: DemoOptions = {}): Record<string, string> {
  const { bin, steps, test } = { ...HELLO, ...options };
  const manifest = {
    name: "demo",
    version: "0.1.0",
    type: "module",
    ...(options.library ? {} : { bin: { demo: "bin/demo.js" } }),
  };
  const files: Record<string, string> = {
    "$INPUT/package.json": `${JSON.stringify(manifest, null, 2)}\n`,
    ...(options.library ? {} : { "$INPUT/bin/demo.js": bin }),
    "$INPUT/features/a.feature": [
      "Feature: Demo",
      "",
      "  @id=SCN-DEMO-001 @status=implemented",
      "  Scenario: Demo",
      ...steps.map((step) => `    ${step}`),
      "",
    ].join("\n"),
    "$INPUT/system-tests/SCN-DEMO-001.test.ts": [
      'import { scenario } from "@opensoftware/testkit";',
      "",
      'scenario("SCN-DEMO-001", async ({ sut, fakes, given, when, then }) => {',
      ...test.map((line) => `  ${line}`),
      "});",
      "",
    ].join("\n"),
  };
  if (options.readme) files["$INPUT/README.md"] = options.readme;
  return files;
}

/**
 * Module demo whose CLI gets `/v0.1/servers?search=tracker` from `DEMO_API_URL` and prints the body; its test scripts
 * `fakes.http` with `routes` (TypeScript source) and expects the body `{"count":1}`.
 */
export function apiModule(routes: string): Record<string, string> {
  return demoModule({
    bin: [
      "const response = await fetch(`${process.env.DEMO_API_URL}/v0.1/servers?search=tracker`);",
      "process.stdout.write(await response.text());",
      "",
    ].join("\n"),
    readme:
      "# demo\n\n## Configuration\n\n| Variable | Meaning |\n| --- | --- |\n| `DEMO_API_URL` | Base URL of the API. |\n",
    steps: ['When the user runs "demo"', 'Then the output is {"count":1}'],
    test: [
      `const api = await fakes.http(${routes});`,
      "let run: Awaited<ReturnType<typeof sut.cli>>;",
      "await when('the user runs \"demo\"', async () => {",
      "  run = await sut.cli([], { env: { DEMO_API_URL: api.url } });",
      "});",
      "await then('the output is {\"count\":1}', async () => {",
      "  expect(run.stdout).toBe('{\"count\":1}');",
      "});",
    ],
  });
}

/** The test cases of a JUnit report: name and whether it has a failure. */
export function testCases(report: string): { name: string; failed: boolean }[] {
  return [...report.matchAll(/<testcase [^>]*name="([^"]+)"[^>]*?(\/>|>([\s\S]*?)<\/testcase>)/g)].map((match) => ({
    name: match[1] as string,
    failed: /<failure|<error/.test(match[3] ?? ""),
  }));
}

/**
 * An adapter in $INPUT whose port features in `port/features/` have these implemented @conformance scenarios, and
 * whose system tests pass the scenarios in `tested`.
 */
export function demoAdapter(scenarios: string[], tested: string[]): Record<string, string> {
  const files: Record<string, string> = {
    "$INPUT/package.json": `${JSON.stringify({ name: "demo-adapter", version: "0.1.0", type: "module", bin: { demo: "bin/demo.js" } }, null, 2)}\n`,
    "$INPUT/bin/demo.js": 'process.stdout.write("hello\\n");\n',
    "$INPUT/port/features/demo.feature": [
      "Feature: Demo port",
      "",
      ...scenarios.flatMap((id) => [
        `  @id=${id} @status=implemented @conformance`,
        `  Scenario: ${id}`,
        '    When the user runs "demo"',
        '    Then the output is "hello"',
        "",
      ]),
    ].join("\n"),
  };
  for (const id of tested) {
    files[`$INPUT/system-tests/${id}.test.ts`] = [
      'import { scenario } from "@opensoftware/testkit";',
      "",
      `scenario("${id}", async ({ sut, when, then }) => {`,
      ...HELLO.test.map((line) => `  ${line}`),
      "});",
      "",
    ].join("\n");
  }
  return files;
}

/** Call counts of the functions of the script whose URL ends with `suffix`, from V8 coverage files. */
export function functionCounts(reports: string[], suffix: string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const report of reports) {
    const { result } = JSON.parse(report) as {
      result: { url: string; functions: { functionName: string; ranges: { count: number }[] }[] }[];
    };
    for (const script of result.filter((entry) => entry.url.endsWith(suffix))) {
      for (const fn of script.functions) counts[fn.functionName] = fn.ranges[0]?.count ?? 0;
    }
  }
  return counts;
}

/**
 * Module demo whose CLI posts `{"n":1}` to `/v1/traces` at `DEMO_API_URL` twice and prints both status codes; its
 * test scripts `fakes.http` with `routes` (TypeScript source) and runs `expectations` (TypeScript lines with `run`
 * and `api`).
 */
export function postModule(routes: string, expectations: string[]): Record<string, string> {
  return demoModule({
    bin: [
      "const codes = [];",
      "for (const _ of [1, 2]) {",
      '  const response = await fetch(`${process.env.DEMO_API_URL}/v1/traces`, { method: "POST", body: \'{"n":1}\' });',
      "  codes.push(response.status);",
      "}",
      'process.stdout.write(codes.join(" "));',
      "",
    ].join("\n"),
    readme:
      "# demo\n\n## Configuration\n\n| Variable | Meaning |\n| --- | --- |\n| `DEMO_API_URL` | Base URL of the API. |\n",
    steps: ['When the user runs "demo"', "Then the fake answered as scripted"],
    test: [
      `const api = await fakes.http(${routes});`,
      "let run: Awaited<ReturnType<typeof sut.cli>>;",
      "await when('the user runs \"demo\"', async () => {",
      "  run = await sut.cli([], { env: { DEMO_API_URL: api.url } });",
      "});",
      "await then('the fake answered as scripted', async () => {",
      ...expectations.map((line) => `  ${line}`),
      "});",
    ],
  });
}

/** A Collector config that receives OTLP/HTTP on 4318, runs the one `processor` (YAML lines) and exports as JSON. */
export function collectorConfig(processor: string[]): string {
  const name = (processor[0] ?? "").replace(":", "");
  return [
    "receivers:",
    "  otlp:",
    "    protocols:",
    "      http:",
    "        endpoint: 0.0.0.0:4318",
    "processors:",
    ...processor.map((line) => `  ${line}`),
    "exporters:",
    "  otlphttp:",
    "    endpoint: ${env:OTEL_EXPORTER_OTLP_ENDPOINT}",
    "    encoding: json",
    "service:",
    "  pipelines:",
    "    traces:",
    "      receivers: [otlp]",
    `      processors: [${name}]`,
    "      exporters: [otlphttp]",
    "",
  ].join("\n");
}

/** One OTLP/JSON request with the span "work". */
export const WORK_SPAN = {
  resourceSpans: [
    {
      resource: { attributes: [] },
      scopeSpans: [
        {
          spans: [
            {
              traceId: "5b8e0c7e1d2a4f009a7e0d1f2a3b4c5d",
              spanId: "0000000000000001",
              name: "work",
              kind: 1,
              startTimeUnixNano: "1767225600000000000",
              endTimeUnixNano: "1767225660000000000",
            },
          ],
        },
      ],
    },
  ],
};

/**
 * Module demo with a composite GitHub Action: `action.yml` holds the `steps` (YAML lines below `steps:`), the input
 * `name` without a default and the input `command`; the CLI prints "hello <first argument>". Its test runs `test` (TypeScript lines).
 */
export function actionModule(actionSteps: string[], steps: string[], test: string[]): Record<string, string> {
  return {
    ...demoModule({ bin: "process.stdout.write(`hello ${process.argv[2]}\\n`);\n", steps, test }),
    "$INPUT/action.yml": [
      "name: demo",
      "description: Greets.",
      "inputs:",
      "  name:",
      "    description: Who to greet.",
      "  command:",
      "    description: The demo command.",
      "    default: npx demo",
      "runs:",
      "  using: composite",
      "  steps:",
      ...actionSteps.map((line) => `    ${line}`),
      "",
    ].join("\n"),
  };
}

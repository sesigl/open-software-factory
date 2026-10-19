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
  const files: Record<string, string> = {
    "$INPUT/package.json": `${JSON.stringify({ name: "demo", version: "0.1.0", type: "module", bin: { demo: "bin/demo.js" } }, null, 2)}\n`,
    "$INPUT/bin/demo.js": bin,
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

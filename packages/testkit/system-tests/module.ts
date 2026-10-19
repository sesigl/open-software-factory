// Text builders for the small modules the system tests create. They only build strings; the tests put them into
// $INPUT through sut.files.

/** The steps of SCN-DEMO-001: the CLI says hello. */
const HELLO = [
  "  let run: Awaited<ReturnType<typeof sut.cli>>;",
  "  await when('the user runs \"demo\"', async () => {",
  "    run = await sut.cli([]);",
  "  });",
  "  await then('the output is \"hello\"', async () => {",
  '    expect(run.stdout).toBe("hello\\n");',
  "  });",
];

/**
 * The files of module demo with the implemented scenario SCN-DEMO-001 and its system test, keyed by their path
 * below $INPUT. `before` is test code that runs before the steps.
 */
export function demoModule(before: string[] = []): Record<string, string> {
  return {
    "$INPUT/package.json": `${JSON.stringify({ name: "demo", version: "0.1.0", type: "module", bin: { demo: "bin/demo.js" } }, null, 2)}\n`,
    "$INPUT/bin/demo.js": 'process.stdout.write("hello\\n");\n',
    "$INPUT/features/a.feature": [
      "Feature: Demo",
      "",
      "  @id=SCN-DEMO-001 @status=implemented",
      "  Scenario: Demo says hello",
      '    When the user runs "demo"',
      '    Then the output is "hello"',
      "",
    ].join("\n"),
    "$INPUT/system-tests/SCN-DEMO-001.test.ts": [
      'import { scenario } from "@opensoftware/testkit";',
      "",
      'scenario("SCN-DEMO-001", async ({ sut, when, then }) => {',
      ...before.map((line) => `  ${line}`),
      ...HELLO,
      "});",
      "",
    ].join("\n"),
  };
}

// Text builders for the small modules the system tests create. They only build strings; the tests put them into
// the working folder through sut.files.

/** The files of module demo with the implemented scenario SCN-DEMO-001 and its passing system test. */
export function demoModule(): Record<string, string> {
  return {
    "package.json": `${JSON.stringify({ name: "demo", version: "0.1.0", type: "module", bin: { demo: "bin/demo.js" } }, null, 2)}\n`,
    "bin/demo.js": 'process.stdout.write("hello\\n");\n',
    "features/a.feature": [
      "Feature: Demo",
      "",
      "  @id=SCN-DEMO-001 @status=implemented",
      "  Scenario: Demo says hello",
      '    When the user runs "demo"',
      '    Then the output is "hello"',
      "",
    ].join("\n"),
    "system-tests/SCN-DEMO-001.test.ts": [
      'import { scenario } from "@opensoftware/testkit";',
      "",
      'scenario("SCN-DEMO-001", async ({ sut, when, then }) => {',
      "  let run: Awaited<ReturnType<typeof sut.cli>>;",
      "  await when('the user runs \"demo\"', async () => {",
      "    run = await sut.cli([]);",
      "  });",
      "  await then('the output is \"hello\"', async () => {",
      '    expect(run.stdout).toBe("hello\\n");',
      "  });",
      "});",
      "",
    ].join("\n"),
  };
}

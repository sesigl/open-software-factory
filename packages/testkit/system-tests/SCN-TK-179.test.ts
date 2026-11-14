import { scenario } from "@opensoftware/testkit";
import { demoModule, testCases } from "./module.ts";

/** One scenario of the demo module: it starts fakes.openbao and runs `body`; the CLI prints "hello". */
function demoScenario(id: string, body: string[]): string[] {
  return [
    `scenario("${id}", async ({ sut, fakes, when, then }) => {`,
    "  const bao = await fakes.openbao();",
    "  let run: Awaited<ReturnType<typeof sut.cli>>;",
    "  await when('the user runs \"demo\"', async () => {",
    "    run = await sut.cli([]);",
    "  });",
    "  await then('the output is \"hello\"', async () => {",
    '    expect(run.stdout).toBe("hello\\n");',
    ...body.map((line) => `    ${line}`),
    "  });",
    "});",
  ];
}

scenario("SCN-TK-179", async ({ sut, given, when, then }) => {
  let first: string[] = [];
  let second: string[] = [];
  await given("a module whose two scenarios in one test file each start fakes.openbao", async () => {
    const steps = ['    When the user runs "demo"', '    Then the output is "hello"'];
    const { "$INPUT/system-tests/SCN-DEMO-001.test.ts": _test, ...module } = demoModule();
    for (const [path, content] of Object.entries(module)) await sut.files.put(path, content);
    await sut.files.put(
      "$INPUT/features/a.feature",
      [
        "Feature: Demo",
        "",
        ...["SCN-DEMO-001", "SCN-DEMO-002"].flatMap((id) => [
          `  @id=${id} @status=implemented`,
          `  Scenario: Demo ${id}`,
          ...steps,
          "",
        ]),
      ].join("\n"),
    );
  });

  await given('its first scenario writes "demo" into its mount', async () => {
    first = demoScenario("SCN-DEMO-001", [
      'await bao.write("demo", { value: "bao_test_1" });',
      "url = bao.url;",
      "mount = bao.mount;",
    ]);
  });

  await given(
    'its second scenario expects the address of the first, another mount, and no "demo" in its mount',
    async () => {
      second = demoScenario("SCN-DEMO-002", [
        "expect(bao.url).toBe(url);",
        "expect(bao.mount).not.toBe(mount);",
        'expect(await bao.read("demo")).toBeUndefined();',
      ]);
      await sut.files.put(
        "$INPUT/system-tests/SCN-DEMO-001.test.ts",
        [
          'import { scenario } from "@opensoftware/testkit";',
          "",
          'let url = "";',
          'let mount = "";',
          ...first,
          ...second,
          "",
        ].join("\n"),
      );
    },
  );

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

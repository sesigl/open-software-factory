import { scenario } from "@opensoftware/testkit";
import { demoModule, FORGE_API, FORGE_README, testCases } from "./module.ts";

/** One scenario of the demo module: it creates "demo" with one pull request and runs the CLI on it. */
function demoScenario(id: string, last: string[]): string[] {
  return [
    `scenario("${id}", async ({ sut, fakes, when, then }) => {`,
    "  const forge = await fakes.forge();",
    '  await forge.createRepository("demo");',
    '  await forge.openPullRequest("demo", { branch: "fix", title: "Fix the typo", files: { "notes.md": "hi\\n" } });',
    "  let run: Awaited<ReturnType<typeof sut.cli>>;",
    "  await when('the user runs \"demo\"', async () => {",
    "    run = await sut.cli([`${forge.owner}/demo`], { env: { DEMO_FORGE_URL: forge.url, DEMO_FORGE_TOKEN: forge.token } });",
    "  });",
    "  await then('the output is \"1\"', async () => {",
    '    expect(run.stdout, run.stderr).toBe("1");',
    ...last.map((line) => `    ${line}`),
    "  });",
    "});",
  ];
}

scenario("SCN-TK-101", async ({ sut, given, when, then }) => {
  let bin = "";
  await given('a module whose CLI prints the number of pull requests of a repository at "DEMO_FORGE_URL"', async () => {
    bin = [
      ...FORGE_API,
      'const pulls = await api("GET", "/pulls?state=all");',
      "process.stdout.write(String(pulls.length));",
      "",
    ].join("\n");
  });

  let first: string[] = [];
  await given(
    'its two scenarios in one test file each create the repository "demo" in fakes.forge, open a pull request and expect "1"',
    async () => {
      first = demoScenario("SCN-DEMO-001", ["url = forge.url;"]);
    },
  );

  await given("its second scenario expects the forge URL of the first", async () => {
    const steps = ['    When the user runs "demo"', '    Then the output is "1"'];
    const module = {
      ...demoModule({ bin, readme: FORGE_README }),
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
        'let url = "";',
        ...first,
        ...demoScenario("SCN-DEMO-002", ["expect(forge.url).toBe(url);"]),
        "",
      ].join("\n"),
    };
    for (const [path, content] of Object.entries(module)) await sut.files.put(path, content);
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

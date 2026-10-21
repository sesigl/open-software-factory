import { scenario } from "@opensoftware/testkit";
import { demoModule, testCases } from "./module.ts";

scenario("SCN-TK-044", async ({ sut, given, when, then }) => {
  let module: Record<string, string> = {};
  await given('a module whose CLI prints the environment variable "__STRYKER_ACTIVE_MUTANT__"', async () => {
    module = demoModule({
      bin: "process.stdout.write(`${process.env.__STRYKER_ACTIVE_MUTANT__}`);\n",
      steps: ['When the user runs "demo"', 'Then the output is "7"'],
      test: [
        "let run: Awaited<ReturnType<typeof sut.cli>>;",
        "await when('the user runs \"demo\"', async () => {",
        "  run = await sut.cli([]);",
        "});",
        "await then('the output is \"7\"', async () => {",
        '  expect(run.stdout).toBe("7");',
        "});",
      ],
    });
  });

  await given('its system test expects the output "7"', async () => {
    for (const [path, content] of Object.entries(module)) await sut.files.put(path, content);
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when(
    'the developer runs "testkit run --junit report.xml" with __STRYKER_ACTIVE_MUTANT__ "7" in the module',
    async () => {
      run = await sut.cli(["run", "--junit", "report.xml"], { env: { __STRYKER_ACTIVE_MUTANT__: "7" } });
    },
  );

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

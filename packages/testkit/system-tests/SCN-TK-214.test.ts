import { scenario } from "@opensoftware/testkit";
import { demoModule, testCases } from "./module.ts";

scenario("SCN-TK-214", async ({ sut, given, when, then }) => {
  let module: Record<string, string> = {};
  await given('a module whose CLI prints the environment variable "OSF_TEST_HOOKS"', async () => {
    module = demoModule({
      bin: "process.stdout.write(`${process.env.OSF_TEST_HOOKS}`);\n",
      steps: ['When the user runs "demo"', 'Then the output is "1"'],
      test: [
        "let run: Awaited<ReturnType<typeof sut.cli>>;",
        "await when('the user runs \"demo\"', async () => {",
        "  run = await sut.cli([]);",
        "});",
        "await then('the output is \"1\"', async () => {",
        '  expect(run.stdout).toBe("1");',
        "});",
      ],
    });
  });

  await given('its system test expects the output "1"', async () => {
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

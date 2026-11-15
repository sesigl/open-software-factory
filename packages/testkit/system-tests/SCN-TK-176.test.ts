import { scenario } from "@opensoftware/testkit";
import { demoModule, testCases } from "./module.ts";

scenario("SCN-TK-176", async ({ sut, given, when, then }) => {
  let bin = "";
  await given("a module whose CLI prints what it reads from standard input in capitals", async () => {
    // The CLI ends only when its standard input is closed.
    bin = [
      "let text = '';",
      "for await (const chunk of process.stdin) text += chunk;",
      "process.stdout.write(text.toUpperCase());",
      "",
    ].join("\n");
  });

  await given('its system test runs it with the stdin "hello" and expects the output "HELLO"', async () => {
    const module = demoModule({
      bin,
      steps: ['When the user pipes "hello" into "demo"', 'Then the output is "HELLO"'],
      test: [
        "let run: Awaited<ReturnType<typeof sut.cli>>;",
        'await when(\'the user pipes "hello" into "demo"\', async () => {',
        '  run = await sut.cli([], { stdin: "hello" });',
        "});",
        "await then('the output is \"HELLO\"', async () => {",
        '  expect(run.stdout, run.stderr).toBe("HELLO");',
        "});",
      ],
    });
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

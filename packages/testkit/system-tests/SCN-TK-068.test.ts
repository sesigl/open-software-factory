import { scenario } from "@opensoftware/testkit";
import { messagesModule, testCases } from "./module.ts";

scenario("SCN-TK-068", async ({ sut, given, when, then }) => {
  let module: Record<string, string> = {};
  await given(
    'a module whose CLI sends "add a date" to the Anthropic Messages endpoint at "DEMO_ANTHROPIC_URL", gives up after 500 milliseconds and prints "gave up"',
    async () => {
      module = messagesModule(
        [
          'await call("add a date", { signal: AbortSignal.timeout(500) }).then(',
          '  () => process.stdout.write("answered\\n"),',
          '  () => process.stdout.write("gave up\\n"),',
          ");",
        ],
        ['When the user runs "demo"', 'Then the output is "gave up"'],
        [
          'const gateway = await fakes.modelGateway([{ when: "add a date", reply: "", hangs: true }]);',
          "let run: Awaited<ReturnType<typeof sut.cli>>;",
          "await when('the user runs \"demo\"', async () => {",
          "  run = await sut.cli([], { env: { DEMO_ANTHROPIC_URL: gateway.anthropicUrl } });",
          "});",
          "await then('the output is \"gave up\"', async () => {",
          '  expect(run.stdout, run.stderr).toBe("gave up\\n");',
          "});",
        ],
      );
    },
  );

  await given(
    'its system test scripts a reply that hangs for a request that contains "add a date" and expects "gave up"',
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

import { scenario } from "@opensoftware/testkit";
import { messagesModule, testCases } from "./module.ts";

scenario("SCN-TK-065", async ({ sut, given, when, then }) => {
  let module: Record<string, string> = {};
  await given(
    'a module whose CLI sends "Say hello" to the Anthropic Messages endpoint at "DEMO_ANTHROPIC_URL" and prints the text and the stop reason',
    async () => {
      module = messagesModule(
        [
          'const { content, stop_reason } = await (await call("Say hello")).json();',
          "process.stdout.write(`${content[0].text} ${stop_reason}\\n`);",
        ],
        ['When the user runs "demo"', 'Then the output is "Hello, Ada end_turn"'],
        [
          'const gateway = await fakes.modelGateway([{ when: "Say hello", reply: "Hello, Ada" }]);',
          "let run: Awaited<ReturnType<typeof sut.cli>>;",
          "await when('the user runs \"demo\"', async () => {",
          "  run = await sut.cli([], { env: { DEMO_ANTHROPIC_URL: gateway.anthropicUrl } });",
          "});",
          "await then('the output is \"Hello, Ada end_turn\"', async () => {",
          '  expect(run.stdout, run.stderr).toBe("Hello, Ada end_turn\\n");',
          "});",
        ],
      );
    },
  );

  await given(
    'its system test scripts the reply "Hello, Ada" for a request that contains "Say hello" and expects "Hello, Ada end_turn"',
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

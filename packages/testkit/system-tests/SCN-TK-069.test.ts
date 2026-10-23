import { scenario } from "@opensoftware/testkit";
import { messagesModule, testCases } from "./module.ts";

scenario("SCN-TK-069", async ({ sut, given, when, then }) => {
  let module: Record<string, string> = {};
  await given(
    'a module whose CLI sends "Say hello" to the Anthropic Messages endpoint at "DEMO_ANTHROPIC_URL" and prints the stop reason and the token usage',
    async () => {
      module = messagesModule(
        [
          'const { stop_reason, usage } = await (await call("Say hello")).json();',
          "process.stdout.write(`${stop_reason} ${usage.input_tokens} ${usage.output_tokens}\\n`);",
        ],
        ['When the user runs "demo"', 'Then the output is "refusal 1000 200"'],
        [
          'const gateway = await fakes.modelGateway([{ when: "Say hello", reply: "", stopReason: "refusal", usage: { prompt_tokens: 1000, completion_tokens: 200 } }]);',
          "let run: Awaited<ReturnType<typeof sut.cli>>;",
          "await when('the user runs \"demo\"', async () => {",
          "  run = await sut.cli([], { env: { DEMO_ANTHROPIC_URL: gateway.anthropicUrl } });",
          "});",
          "await then('the output is \"refusal 1000 200\"', async () => {",
          '  expect(run.stdout, run.stderr).toBe("refusal 1000 200\\n");',
          "});",
        ],
      );
    },
  );

  await given(
    'its system test scripts the stop reason "refusal" with 1000 prompt tokens and 200 completion tokens and expects "refusal 1000 200"',
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

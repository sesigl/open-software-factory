import { scenario } from "@opensoftware/testkit";
import { openaiModule, testCases } from "./module.ts";

scenario("SCN-TK-076", async ({ sut, given, when, then }) => {
  let module: Record<string, string> = {};
  await given(
    'a module whose CLI streams a chat completions call that contains "fix the typo" from "DEMO_MODEL_URL" and prints each tool call, the finish reason and the token usage',
    async () => {
      module = openaiModule(
        [
          'const all = await events(await call("/chat/completions", { messages: [{ role: "user", content: "fix the typo" }] }));',
          "const call0 = all.flatMap((event) => event.choices).find((choice) => choice.delta.tool_calls).delta.tool_calls[0];",
          "const finish = all.flatMap((event) => event.choices).find((choice) => choice.finish_reason).finish_reason;",
          "const { usage } = all.find((event) => event.usage);",
          "process.stdout.write(`${call0.function.name} ${call0.function.arguments} ${finish} ${usage.prompt_tokens} ${usage.completion_tokens}\\n`);",
        ],
        ['When the user runs "demo"', 'Then the output is "edit {"filePath":"notes.md"} tool_calls 1000 200"'],
        [
          'const gateway = await fakes.modelGateway([{ when: "fix the typo", reply: "", tools: [{ name: "edit", input: { filePath: "notes.md" } }], usage: { prompt_tokens: 1000, completion_tokens: 200 } }]);',
          "let run: Awaited<ReturnType<typeof sut.cli>>;",
          "await when('the user runs \"demo\"', async () => {",
          "  run = await sut.cli([], { env: { DEMO_MODEL_URL: gateway.url } });",
          "});",
          'await then(\'the output is "edit {"filePath":"notes.md"} tool_calls 1000 200"\', async () => {',
          '  expect(run.stdout, run.stderr).toBe(\'edit {"filePath":"notes.md"} tool_calls 1000 200\\n\');',
          "});",
        ],
      );
    },
  );

  await given(
    'its system test scripts the tool "edit" with the input "{"filePath":"notes.md"}" and 1000 prompt tokens and 200 completion tokens, and expects "edit {"filePath":"notes.md"} tool_calls 1000 200"',
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

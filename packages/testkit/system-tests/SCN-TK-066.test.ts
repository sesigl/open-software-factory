import { scenario } from "@opensoftware/testkit";
import { messagesModule, testCases } from "./module.ts";

scenario("SCN-TK-066", async ({ sut, given, when, then }) => {
  let module: Record<string, string> = {};
  await given(
    'a module whose CLI streams a Messages API call that contains "fix the typo" from "DEMO_ANTHROPIC_URL" and prints each tool call and the stop reason',
    async () => {
      module = messagesModule(
        [
          'const text = await (await call("fix the typo", { stream: true })).text();',
          'const events = text.split("\\n").filter((line) => line.startsWith("data: ")).map((line) => JSON.parse(line.slice(6)));',
          'const name = events.find((event) => event.content_block?.type === "tool_use").content_block.name;',
          'const input = events.find((event) => event.delta?.type === "input_json_delta").delta.partial_json;',
          'const stop = events.find((event) => event.type === "message_delta").delta.stop_reason;',
          "process.stdout.write(`${name} ${input} ${stop}\\n`);",
        ],
        ['When the user runs "demo"', 'Then the output is "Write {"file_path":"notes.md"} tool_use"'],
        [
          'const gateway = await fakes.modelGateway([{ when: "fix the typo", reply: "", tools: [{ name: "Write", input: { file_path: "notes.md" } }] }]);',
          "let run: Awaited<ReturnType<typeof sut.cli>>;",
          "await when('the user runs \"demo\"', async () => {",
          "  run = await sut.cli([], { env: { DEMO_ANTHROPIC_URL: gateway.anthropicUrl } });",
          "});",
          'await then(\'the output is "Write {"file_path":"notes.md"} tool_use"\', async () => {',
          '  expect(run.stdout, run.stderr).toBe("Write {\\"file_path\\":\\"notes.md\\"} tool_use\\n");',
          "});",
        ],
      );
    },
  );

  await given(
    'its system test scripts the tool call "Write" with the input "{"file_path":"notes.md"}" and expects "Write {"file_path":"notes.md"} tool_use"',
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

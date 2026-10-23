import { scenario } from "@opensoftware/testkit";
import { openaiModule, testCases } from "./module.ts";

scenario("SCN-TK-074", async ({ sut, given, when, then }) => {
  let module: Record<string, string> = {};
  await given(
    'a module whose CLI streams a Responses API call that contains "fix the typo" from "DEMO_MODEL_URL" and prints each output item',
    async () => {
      module = openaiModule(
        [
          'const all = await events(await call("/responses", { input: [{ role: "user", content: "fix the typo" }] }));',
          'for (const { item } of all.filter((event) => event.type === "response.output_item.done")) {',
          "  process.stdout.write(`${item.type} ${item.name} ${item.arguments ?? item.input}\\n`);",
          "}",
        ],
        ['When the user runs "demo"', "Then the output is a function call and a custom tool call"],
        [
          'const gateway = await fakes.modelGateway([{ when: "fix the typo", reply: "", tools: [{ name: "exec_command", input: { cmd: "cat notes.md" } }, { name: "apply_patch", input: "*** Begin Patch" }] }]);',
          "let run: Awaited<ReturnType<typeof sut.cli>>;",
          "await when('the user runs \"demo\"', async () => {",
          "  run = await sut.cli([], { env: { DEMO_MODEL_URL: gateway.url } });",
          "});",
          "await then('the output is a function call and a custom tool call', async () => {",
          '  expect(run.stdout, run.stderr).toBe(\'function_call exec_command {"cmd":"cat notes.md"}\\ncustom_tool_call apply_patch *** Begin Patch\\n\');',
          "});",
        ],
      );
    },
  );

  await given(
    'its system test scripts the tool "exec_command" with the input "{"cmd":"cat notes.md"}" and the tool "apply_patch" with the text input "*** Begin Patch", and expects "function_call exec_command {"cmd":"cat notes.md"}" and "custom_tool_call apply_patch *** Begin Patch"',
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

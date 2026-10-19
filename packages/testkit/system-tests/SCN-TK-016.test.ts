import { scenario } from "@opensoftware/testkit";
import { demoModule, testCases } from "./module.ts";

scenario("SCN-TK-016", async ({ sut, given, when, then }) => {
  let module: Record<string, string> = {};
  await given('a module whose MCP server on stdio has the tool "greet" that answers "hello Ada"', async () => {
    module = demoModule({
      bin: [
        'import { createInterface } from "node:readline";',
        'const send = (message) => process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", ...message })}\\n`);',
        'createInterface({ input: process.stdin }).on("line", (line) => {',
        "  const request = JSON.parse(line);",
        "  if (request.id === undefined) return;",
        '  if (request.method === "initialize") {',
        "    const { protocolVersion } = request.params;",
        '    send({ id: request.id, result: { protocolVersion, capabilities: { tools: {} }, serverInfo: { name: "demo", version: "0.1.0" } } });',
        '  } else if (request.method === "tools/list") {',
        '    const inputSchema = { type: "object", properties: { name: { type: "string" } }, required: ["name"] };',
        '    send({ id: request.id, result: { tools: [{ name: "greet", description: "Greets a person.", inputSchema }] } });',
        '  } else if (request.method === "tools/call") {',
        '    send({ id: request.id, result: { content: [{ type: "text", text: `hello ${request.params.arguments.name}` }] } });',
        "  } else {",
        '    send({ id: request.id, error: { code: -32601, message: "Method not found" } });',
        "  }",
        "});",
        "",
      ].join("\n"),
      readme: ["# demo", "", "## Configuration", "", "| Variable | Meaning |", "| --- | --- |", ""].join("\n"),
      steps: ['When the user calls the tool "greet" with the name "Ada"', 'Then the tool answers "hello Ada"'],
      test: [
        "let tools: string[] = [];",
        "let answer: unknown;",
        'await when(\'the user calls the tool "greet" with the name "Ada"\', async () => {',
        '  const client = await sut.mcp.connect(["mcp"]);',
        "  tools = (await client.listTools()).tools.map((tool) => tool.name);",
        '  answer = (await client.callTool({ name: "greet", arguments: { name: "Ada" } })).content;',
        "});",
        "await then('the tool answers \"hello Ada\"', async () => {",
        '  expect(tools).toEqual(["greet"]);',
        '  expect(answer).toEqual([{ type: "text", text: "hello Ada" }]);',
        "});",
      ],
    });
  });

  await given('its system test calls "greet" through sut.mcp and expects "hello Ada"', async () => {
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

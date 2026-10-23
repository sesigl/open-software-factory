import { scenario } from "@opensoftware/testkit";
import { demoModule, testCases } from "./module.ts";

// The library's one export: an ACP agent on the streams it gets, as JSON lines, that ends when its input ends.
const AGENT = [
  'import { createInterface } from "node:readline";',
  "export function serve({ input, output }) {",
  '  const send = (message) => output.write(`${JSON.stringify({ jsonrpc: "2.0", ...message })}\\n`);',
  "  const lines = createInterface({ input });",
  '  lines.on("line", (line) => {',
  "    const message = JSON.parse(line);",
  '    if (message.method === "initialize") {',
  "      send({ id: message.id, result: { protocolVersion: 1, agentCapabilities: {}, authMethods: [] } });",
  '    } else if (message.method === "session/new") {',
  '      send({ id: message.id, result: { sessionId: "s1" } });',
  '    } else if (message.method === "session/prompt") {',
  '      const name = message.params.prompt[0].text.slice("greet ".length);',
  '      const update = { sessionUpdate: "agent_message_chunk", content: { type: "text", text: `hello ${name}` } };',
  '      send({ method: "session/update", params: { sessionId: "s1", update } });',
  '      send({ id: message.id, result: { stopReason: "end_turn" } });',
  "    }",
  "  });",
  '  return new Promise((resolve) => lines.on("close", resolve));',
  "}",
  "",
].join("\n");

scenario("SCN-TK-071", async ({ sut, given, when, then }) => {
  let library: Record<string, string> = {};
  await given(
    'a library whose exported function serves an ACP agent on the streams it gets and answers "greet Ada" with "hello Ada"',
    async () => {
      library = {
        ...demoModule({
          library: true,
          steps: ['When the client sends "greet Ada"', 'Then the turn ends with "end_turn" and the reply "hello Ada"'],
          test: [
            "let turn: { stopReason: string; reply: string } | undefined;",
            "await when('the client sends \"greet Ada\"', async () => {",
            '  const { serve } = await import("../index.js");',
            "  const client = await sut.acp.serve(serve);",
            "  const session = await client.newSession();",
            '  turn = await session.prompt("greet Ada");',
            "});",
            'await then(\'the turn ends with "end_turn" and the reply "hello Ada"\', async () => {',
            '  expect(turn).toEqual({ stopReason: "end_turn", reply: "hello Ada" });',
            "});",
          ],
        }),
        "$INPUT/index.js": AGENT,
      };
    },
  );

  await given(
    'its system test serves that function with sut.acp.serve, sends "greet Ada" and expects "end_turn" with the reply "hello Ada"',
    async () => {
      for (const [path, content] of Object.entries(library)) await sut.files.put(path, content);
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "testkit run --junit report.xml" in the library', async () => {
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

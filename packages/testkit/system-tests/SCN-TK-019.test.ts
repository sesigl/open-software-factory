import { scenario } from "@opensoftware/testkit";
import { demoModule, testCases } from "./module.ts";

scenario("SCN-TK-019", async ({ sut, given, when, then }) => {
  let module: Record<string, string> = {};
  await given(
    'a module whose CLI sends a prompt over ACP to the agent in "DEMO_AGENT_COMMAND" and prints the stop reason and the reply',
    async () => {
      module = demoModule({
        bin: [
          'import { spawn } from "node:child_process";',
          'import { createInterface } from "node:readline";',
          "const [command, ...args] = JSON.parse(process.env.DEMO_AGENT_COMMAND);",
          'const agent = spawn(command, args, { stdio: ["pipe", "pipe", "inherit"] });',
          "const pending = new Map();",
          'let reply = "";',
          'const send = (message) => agent.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", ...message })}\\n`);',
          "const request = (method, params) =>",
          "  new Promise((resolve, reject) => {",
          "    const id = pending.size + 1;",
          "    pending.set(id, { resolve, reject });",
          "    send({ id, method, params });",
          "  });",
          'createInterface({ input: agent.stdout }).on("line", (line) => {',
          "  const message = JSON.parse(line);",
          '  if (message.method === "session/update") {',
          "    const { update } = message.params;",
          '    if (update.sessionUpdate === "agent_message_chunk") reply += update.content.text;',
          "  } else if (message.method) {",
          '    send({ id: message.id, error: { code: -32601, message: "not supported" } });',
          "  } else {",
          "    const { resolve, reject } = pending.get(message.id);",
          "    if (message.error) reject(new Error(message.error.message));",
          "    else resolve(message.result);",
          "  }",
          "});",
          'await request("initialize", { protocolVersion: 1, clientCapabilities: {} });',
          'const { sessionId } = await request("session/new", { cwd: process.cwd(), mcpServers: [] });',
          'const { stopReason } = await request("session/prompt", { sessionId, prompt: [{ type: "text", text: process.argv[2] }] });',
          "process.stdout.write(`${stopReason}: ${reply}\\n`);",
          "agent.kill();",
          "",
        ].join("\n"),
        readme: [
          "# demo",
          "",
          "## Configuration",
          "",
          "| Variable | Meaning |",
          "| --- | --- |",
          "| `DEMO_AGENT_COMMAND` | The ACP agent to start, as a JSON array of the command and its arguments. |",
          "",
        ].join("\n"),
        steps: [
          'When the user runs "demo" with the prompt "fix the typo"',
          'Then the output is "end_turn: done"',
          'And "notes.md" says "fixed"',
        ],
        test: [
          'const harness = await fakes.harness([{ when: "fix the typo", edits: { "notes.md": "fixed\\n" }, reply: "done" }]);',
          "const agent = JSON.stringify([harness.command, ...harness.args]);",
          "let run: Awaited<ReturnType<typeof sut.cli>>;",
          'await when(\'the user runs "demo" with the prompt "fix the typo"\', async () => {',
          '  run = await sut.cli(["fix the typo"], { env: { DEMO_AGENT_COMMAND: agent } });',
          "});",
          "await then('the output is \"end_turn: done\"', async () => {",
          '  expect(run.stdout, run.stderr).toBe("end_turn: done\\n");',
          "});",
          'await then(\'"notes.md" says "fixed"\', async () => {',
          '  expect(await sut.files.read("$INPUT/notes.md")).toBe("fixed\\n");',
          "});",
        ],
      });
    },
  );

  await given(
    'its system test scripts fakes.harness to write "fixed" to "notes.md" and reply "done" when the prompt says "fix the typo"',
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

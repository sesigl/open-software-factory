import { scenario } from "@opensoftware/testkit";
import { acpAgentModule, testCases } from "./module.ts";

scenario("SCN-TK-056", async ({ sut, given, when, then }) => {
  let module: Record<string, string> = {};
  await given(
    'a module whose ACP agent on stdio answers "greet Ada" with "hello Ada from" and the name of the session\'s folder',
    async () => {
      module = acpAgentModule(
        [
          'When the client sends "greet Ada" in a session in "$INPUT/work"',
          'Then the turn ends with "end_turn" and the reply "hello Ada from work"',
        ],
        [
          "let turn: { stopReason: string; reply: string } | undefined;",
          "let agent: { name?: string; version?: string } = {};",
          'await when(\'the client sends "greet Ada" in a session in "$INPUT/work"\', async () => {',
          "  const client = await sut.acp.connect();",
          "  agent = client.agent;",
          '  const session = await client.newSession("$INPUT/work");',
          '  turn = await session.prompt("greet Ada");',
          "});",
          'await then(\'the turn ends with "end_turn" and the reply "hello Ada from work"\', async () => {',
          '  expect(agent).toEqual({ name: "demo", version: "0.1.0" });',
          '  expect(turn).toEqual({ stopReason: "end_turn", reply: "hello Ada from work" });',
          "});",
        ],
      );
    },
  );

  await given(
    'its system test starts a session in "$INPUT/work" with sut.acp, sends "greet Ada" and expects "end_turn" with the reply "hello Ada from work"',
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

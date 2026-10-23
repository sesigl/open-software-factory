import { scenario } from "@opensoftware/testkit";
import { acpAgentModule, testCases } from "./module.ts";

scenario("SCN-TK-057", async ({ sut, given, when, then }) => {
  let module: Record<string, string> = {};
  await given(
    'a module whose ACP agent asks to approve the tool "rm -rf build" for "clean up" and replies with the option the client chose',
    async () => {
      module = acpAgentModule(
        [
          'When the client that refuses tool calls sends "clean up"',
          'Then the reply is "reject" and the agent asked to approve "rm -rf build"',
        ],
        [
          'let reply = "";',
          "let requests: unknown[] = [];",
          "await when('the client that refuses tool calls sends \"clean up\"', async () => {",
          "  const client = await sut.acp.connect([], { approve: false });",
          "  const session = await client.newSession();",
          '  reply = (await session.prompt("clean up")).reply;',
          "  requests = client.permissionRequests();",
          "});",
          'await then(\'the reply is "reject" and the agent asked to approve "rm -rf build"\', async () => {',
          '  expect(reply).toBe("reject");',
          '  expect(requests).toEqual([{ sessionId: "s1", title: "rm -rf build", kind: "execute" }]);',
          "});",
        ],
      );
    },
  );

  await given(
    'its system test connects with sut.acp and "approve: false", sends "clean up" and expects the reply "reject" and one request for "rm -rf build"',
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

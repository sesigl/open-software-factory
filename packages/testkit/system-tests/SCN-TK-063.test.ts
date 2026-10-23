import { scenario } from "@opensoftware/testkit";
import { acpClientModule, testCases } from "./module.ts";

scenario("SCN-TK-063", async ({ sut, given, when, then }) => {
  let module: Record<string, string> = {};
  await given(
    'a module whose CLI is an ACP client of the agent in "DEMO_AGENT_COMMAND" that sends "write a novel"',
    async () => {
      module = acpClientModule(
        ['When the user runs "demo prompt:write a novel"', 'Then the output is "write a novel: max_tokens"'],
        [
          'const harness = await fakes.harness([{ when: "write a novel", stopReason: "max_tokens" }]);',
          "let run: Awaited<ReturnType<typeof sut.cli>>;",
          "await when('the user runs \"demo prompt:write a novel\"', async () => {",
          "  const env = { DEMO_AGENT_COMMAND: JSON.stringify([harness.command, ...harness.args]) };",
          '  run = await sut.cli(["prompt:write a novel"], { env });',
          "});",
          "await then('the output is \"write a novel: max_tokens\"', async () => {",
          '  expect(run.stdout, run.stderr).toBe("write a novel: max_tokens\\n");',
          "});",
        ],
      );
    },
  );

  await given(
    'its system test scripts fakes.harness to end the turn of "write a novel" with "max_tokens", and expects "write a novel: max_tokens"',
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

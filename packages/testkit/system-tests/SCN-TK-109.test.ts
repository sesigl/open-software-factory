import { scenario } from "@opensoftware/testkit";
import { acpClientModule, testCases } from "./module.ts";

scenario("SCN-TK-109", async ({ sut, given, when, then }) => {
  let module: Record<string, string> = {};
  await given(
    'a module whose CLI is an ACP client of the agent in "DEMO_AGENT_COMMAND" that opens a session in its folder and sends "fix the typo"',
    async () => {
      module = acpClientModule(
        [
          'When the user runs "demo prompt:fix the typo"',
          "Then the agent recorded the session's folder and model variables",
        ],
        [
          'const harness = await fakes.harness([{ when: "fix the typo", reply: "done" }]);',
          "let run: Awaited<ReturnType<typeof sut.cli>>;",
          "await when('the user runs \"demo prompt:fix the typo\"', async () => {",
          "  const env = {",
          "    DEMO_AGENT_COMMAND: JSON.stringify([harness.command, ...harness.args]),",
          '    OPENAI_MODEL: "routes/default",',
          '    ANTHROPIC_BASE_URL: "http://127.0.0.1:4000",',
          "  };",
          '  run = await sut.cli(["prompt:fix the typo"], { env });',
          "});",
          'await then("the agent recorded the session\'s folder and model variables", async () => {',
          "  expect(run.exitCode, run.stderr).toBe(0);",
          "  const sessions = harness.sessions();",
          "  expect(sessions).toHaveLength(1);",
          '  expect(sessions[0]?.cwd).toBe(sut.files.path("$INPUT"));',
          '  expect(sessions[0]?.env).toMatchObject({ OPENAI_MODEL: "routes/default", ANTHROPIC_BASE_URL: "http://127.0.0.1:4000" });',
          "});",
        ],
        ["OPENAI_MODEL", "ANTHROPIC_BASE_URL"],
      );
    },
  );

  await given(
    'its system test starts the module with "OPENAI_MODEL" set to "routes/default" and "ANTHROPIC_BASE_URL" set to "http://127.0.0.1:4000", and expects one session with that folder and those variables',
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

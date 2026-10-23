import { scenario } from "@opensoftware/testkit";
import { acpClientModule, testCases } from "./module.ts";

scenario("SCN-TK-070", async ({ sut, given, when, then }) => {
  let module: Record<string, string> = {};
  await given(
    'a module whose CLI is an ACP client of the agent in "DEMO_AGENT_COMMAND" that sends "fix the typo" and prints the turn\'s usage and the session\'s cost',
    async () => {
      module = acpClientModule(
        [
          'When the user runs "demo prompt:fix the typo"',
          'Then the output is "cost 0.25 USD", "fix the typo: end_turn" and "usage 1000 200 1200"',
        ],
        [
          "const harness = await fakes.harness([",
          '  { when: "fix the typo", usage: { inputTokens: 1000, outputTokens: 200 }, costUsd: 0.25 },',
          "]);",
          "let run: Awaited<ReturnType<typeof sut.cli>>;",
          "await when('the user runs \"demo prompt:fix the typo\"', async () => {",
          "  const env = { DEMO_AGENT_COMMAND: JSON.stringify([harness.command, ...harness.args]) };",
          '  run = await sut.cli(["prompt:fix the typo"], { env });',
          "});",
          'await then(\'the output is "cost 0.25 USD", "fix the typo: end_turn" and "usage 1000 200 1200"\', async () => {',
          '  expect(run.stdout, run.stderr).toBe("cost 0.25 USD\\nfix the typo: end_turn\\nusage 1000 200 1200\\n");',
          "});",
        ],
      );
    },
  );

  await given(
    'its system test scripts fakes.harness to report 1000 input tokens, 200 output tokens and a cost of 0.25 USD for "fix the typo", and expects "usage 1000 200 1200" and "cost 0.25 USD"',
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

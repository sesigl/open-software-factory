import { scenario } from "@opensoftware/testkit";
import { acpClientModule, testCases } from "./module.ts";

scenario("SCN-TK-119", async ({ sut, given, when, then }) => {
  let module: Record<string, string> = {};
  await given(
    'a module whose CLI is an ACP client of the agent in "DEMO_AGENT_COMMAND" that sends "fix the typo"',
    async () => {
      module = acpClientModule(
        [
          'When the user runs "demo prompt:fix the typo"',
          'Then the output is "reply done" and "fix the typo: end_turn"',
        ],
        [
          "const harness = await fakes.harness([{ when: 'fix the typo', reply: 'done' }], { containers: true });",
          "const mounts = (harness.mounts ?? []).flatMap((folder) => ['--volume', `${folder}:${folder}`]);",
          "const docker = ['docker', 'run', '--rm', '--interactive', '--init', '--user', '1000', ...mounts, 'node:24.11.1-bookworm-slim'];",
          "let run: Awaited<ReturnType<typeof sut.cli>>;",
          "await when('the user runs \"demo prompt:fix the typo\"', async () => {",
          "  const env = { DEMO_AGENT_COMMAND: JSON.stringify([...docker, harness.command, ...harness.args]) };",
          '  run = await sut.cli(["prompt:fix the typo"], { env });',
          "});",
          'await then(\'the output is "reply done" and "fix the typo: end_turn"\', async () => {',
          '  expect(run.stdout, run.stderr).toBe("reply done\\nfix the typo: end_turn\\n");',
          "  expect(harness.prompts()).toEqual(['fix the typo']);",
          "});",
        ],
      );
    },
  );

  await given(
    'its system test scripts fakes.harness for containers to reply "done" for "fix the typo" and runs it with "docker run" as the user 1000 with the folders it names',
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

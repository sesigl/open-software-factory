import { scenario } from "@opensoftware/testkit";
import { acpClientModule, testCases } from "./module.ts";

scenario("SCN-TK-136", async ({ sut, given, when, then }) => {
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
          "// The folder of the agent and its SDK, which a sandbox's template holds; the agent's script stays on the host.",
          "const [folder] = (await fakes.harness([], { containers: true })).mounts ?? [];",
          "const { HARNESS_AGENT } = await import('@opensoftware/testkit');",
          "const harness = await fakes.harness([{ when: 'fix the typo', reply: 'done' }], { sandboxes: { agent: HARNESS_AGENT } });",
          "expect(harness.mounts).toBeUndefined();",
          "const docker = ['docker', 'run', '--rm', '--interactive', '--init', '--user', '1000', '--add-host', 'host.docker.internal:host-gateway', '--volume', `${folder}:${folder}:ro`, 'node:24.11.1-bookworm-slim'];",
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
    'its system test scripts fakes.harness for sandboxes to reply "done" for "fix the typo" and runs it with "docker run" with only the folder of the agent and its SDK',
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

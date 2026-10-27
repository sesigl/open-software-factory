import { scenario } from "@opensoftware/testkit";
import { acpClientModule, testCases } from "./module.ts";

scenario("SCN-TK-117", async ({ sut, given, when, then }) => {
  let module: Record<string, string> = {};
  await given(
    'a module whose CLI is an ACP client of the agent in "DEMO_AGENT_COMMAND" that sends "open a pull request"',
    async () => {
      module = acpClientModule(
        [
          'When the user runs "demo prompt:open a pull request"',
          'Then the output is the reply "fixed" and the link, and "open a pull request: end_turn"',
          "And the agent ran both commands with the exit code 0",
        ],
        [
          "const link = 'https://forge.example/acme/web/pulls/1';",
          "const harness = await fakes.harness([",
          "  { when: 'open a pull request', edits: { 'notes.md': 'fixed\\n' }, commands: ['cat notes.md', `echo ${link}`] },",
          "]);",
          "let run: Awaited<ReturnType<typeof sut.cli>>;",
          "await when('the user runs \"demo prompt:open a pull request\"', async () => {",
          "  const env = { DEMO_AGENT_COMMAND: JSON.stringify([harness.command, ...harness.args]) };",
          '  run = await sut.cli(["prompt:open a pull request"], { env });',
          "});",
          "await then('the output is the reply \"fixed\" and the link, and \"open a pull request: end_turn\"', async () => {",
          "  expect(run.stdout, run.stderr).toBe(`reply fixed\\n${link}\\n\\nopen a pull request: end_turn\\n`);",
          "});",
          "await then('the agent ran both commands with the exit code 0', async () => {",
          "  expect(harness.commands()).toEqual([",
          "    { command: 'cat notes.md', exitCode: 0, output: 'fixed\\n' },",
          "    { command: `echo ${link}`, exitCode: 0, output: `${link}\\n` },",
          "  ]);",
          "});",
        ],
      );
    },
  );

  await given(
    'its system test scripts fakes.harness to write "fixed" to "notes.md" and run "cat notes.md" and "echo https://forge.example/acme/web/pulls/1" for "open a pull request", and expects the reply "fixed" and the link, and both commands with the exit code 0',
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

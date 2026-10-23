import { scenario } from "@opensoftware/testkit";
import { acpClientModule, testCases } from "./module.ts";

scenario("SCN-TK-059", async ({ sut, given, when, then }) => {
  let module: Record<string, string> = {};
  await given(
    'a module whose CLI is an ACP client of the agent in "DEMO_AGENT_COMMAND" that refuses every tool call',
    async () => {
      module = acpClientModule(
        [
          'When the user runs "demo --refuse prompt:clean up"',
          'Then the tool call "rm -rf build" was refused and "notes.md" was not written',
        ],
        [
          "const harness = await fakes.harness([",
          '  { when: "clean up", tools: [{ title: "rm -rf build", kind: "execute" }], edits: { "notes.md": "gone\\n" } },',
          "]);",
          "let run: Awaited<ReturnType<typeof sut.cli>>;",
          "await when('the user runs \"demo --refuse prompt:clean up\"', async () => {",
          "  const env = { DEMO_AGENT_COMMAND: JSON.stringify([harness.command, ...harness.args]) };",
          '  run = await sut.cli(["--refuse", "prompt:clean up"], { env });',
          "});",
          'await then(\'the tool call "rm -rf build" was refused and "notes.md" was not written\', async () => {',
          '  expect(run.stdout, run.stderr).toBe("clean up: end_turn\\n");',
          '  expect(harness.toolCalls()).toEqual([{ title: "rm -rf build", kind: "execute", outcome: "refused" }]);',
          '  expect(await sut.files.list("$INPUT")).not.toContain("notes.md");',
          "});",
        ],
      );
    },
  );

  await given(
    'its system test scripts fakes.harness to run the tool "rm -rf build" of kind "execute" and write "gone" to "notes.md" for "clean up", and expects the tool call refused and no "notes.md"',
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

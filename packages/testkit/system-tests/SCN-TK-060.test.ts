import { scenario } from "@opensoftware/testkit";
import { acpClientModule, testCases } from "./module.ts";

scenario("SCN-TK-060", async ({ sut, given, when, then }) => {
  let module: Record<string, string> = {};
  await given(
    'a module whose CLI is an ACP client of the agent in "DEMO_AGENT_COMMAND" that sends "add a date" and then "use the existing date helper" while the first turn runs',
    async () => {
      module = acpClientModule(
        [
          'When the user runs "demo send:add a date sleep:200 prompt:use the existing date helper"',
          'Then both turns end with "end_turn" and the first turn wrote "date.ts"',
        ],
        [
          "const harness = await fakes.harness([",
          '  { when: "add a date", waitsFor: "use the existing date helper", edits: { "date.ts": "helper\\n" }, reply: "done" },',
          "]);",
          "let run: Awaited<ReturnType<typeof sut.cli>>;",
          "await when('the user runs \"demo send:add a date sleep:200 prompt:use the existing date helper\"', async () => {",
          "  const env = { DEMO_AGENT_COMMAND: JSON.stringify([harness.command, ...harness.args]) };",
          '  run = await sut.cli(["send:add a date", "sleep:200", "prompt:use the existing date helper"], { env });',
          "});",
          'await then(\'both turns end with "end_turn" and the first turn wrote "date.ts"\', async () => {',
          '  expect(run.stdout.split("\\n").filter(Boolean).sort(), run.stderr).toEqual([',
          '    "add a date: end_turn",',
          '    "reply done",',
          '    "use the existing date helper: end_turn",',
          "  ]);",
          '  expect(harness.prompts()).toEqual(["add a date", "use the existing date helper"]);',
          '  expect(await sut.files.read("$INPUT/date.ts")).toBe("helper\\n");',
          "});",
        ],
      );
    },
  );

  await given(
    'its system test scripts fakes.harness to keep the turn of "add a date" running until it receives "use the existing date helper", and expects both turns to end with "end_turn"',
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

import { scenario } from "@opensoftware/testkit";
import { acpClientModule, testCases } from "./module.ts";

scenario("SCN-TK-072", async ({ sut, given, when, then }) => {
  let module: Record<string, string> = {};
  await given(
    'a module whose CLI is an ACP client of the agent in "DEMO_AGENT_COMMAND" that sends "add a date" and, while the turn runs, the request "_session/steering" with "use the existing date helper"',
    async () => {
      module = acpClientModule(
        [
          'When the user runs "demo send:add a date sleep:200 steer:use the existing date helper"',
          'Then the steering request was injected and the turn of "add a date" ends with "end_turn"',
        ],
        [
          "const harness = await fakes.harness([",
          '  { when: "add a date", waitsFor: "use the existing date helper", reply: "done" },',
          "]);",
          "let run: Awaited<ReturnType<typeof sut.cli>>;",
          "await when('the user runs \"demo send:add a date sleep:200 steer:use the existing date helper\"', async () => {",
          "  const env = { DEMO_AGENT_COMMAND: JSON.stringify([harness.command, ...harness.args]) };",
          '  run = await sut.cli(["send:add a date", "sleep:200", "steer:use the existing date helper"], { env });',
          "});",
          'await then(\'the steering request was injected and the turn of "add a date" ends with "end_turn"\', async () => {',
          '  expect(run.stdout.split("\\n").filter(Boolean).sort(), run.stderr).toEqual([',
          '    "add a date: end_turn",',
          '    "reply done",',
          '    "steered injected",',
          "  ]);",
          '  expect(harness.steeringRequests()).toEqual(["use the existing date helper"]);',
          "});",
        ],
      );
    },
  );

  await given(
    'its system test scripts fakes.harness to keep the turn of "add a date" running until it receives "use the existing date helper", and expects "steered injected", "add a date: end_turn" and the steering request "use the existing date helper"',
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

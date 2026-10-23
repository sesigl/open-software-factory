import { scenario } from "@opensoftware/testkit";
import { acpClientModule, testCases } from "./module.ts";

scenario("SCN-TK-062", async ({ sut, given, when, then }) => {
  let module: Record<string, string> = {};
  await given(
    'a module whose CLI is an ACP client of the agent in "DEMO_AGENT_COMMAND" that sends "add a date", cancels the session, waits 500 ms and stops the agent',
    async () => {
      module = acpClientModule(
        ['When the user runs "demo send:add a date sleep:200 cancel sleep:500 kill"', "Then the output is empty"],
        [
          'const harness = await fakes.harness([{ when: "add a date", waitsFor: "never", ignoresCancel: true }]);',
          "let run: Awaited<ReturnType<typeof sut.cli>>;",
          "await when('the user runs \"demo send:add a date sleep:200 cancel sleep:500 kill\"', async () => {",
          "  const env = { DEMO_AGENT_COMMAND: JSON.stringify([harness.command, ...harness.args]) };",
          '  run = await sut.cli(["send:add a date", "sleep:200", "cancel", "sleep:500", "kill"], { env });',
          "});",
          "await then('the output is empty', async () => {",
          '  expect(run.stdout, run.stderr).toBe("");',
          '  expect(harness.prompts()).toEqual(["add a date"]);',
          "});",
        ],
      );
    },
  );

  await given(
    'its system test scripts fakes.harness to keep the turn of "add a date" running and to ignore cancel, and expects no end of the turn',
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

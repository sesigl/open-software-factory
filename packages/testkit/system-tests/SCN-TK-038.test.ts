import { scenario } from "@opensoftware/testkit";
import { actionModule, testCases } from "./module.ts";

scenario("SCN-TK-038", async ({ sut, given, when, then }) => {
  let module: Record<string, string> = {};
  await given(
    'a module whose composite action.yml runs "exit 3" in its first step and "echo second" in its second',
    async () => {
      module = actionModule(
        ["- shell: bash", "  run: exit 3", "- shell: bash", "  run: echo second"],
        ["When the workflow runs the action", "Then the action fails with the exit code 3"],
        [
          "let run: Awaited<ReturnType<typeof sut.action>>;",
          "await when('the workflow runs the action', async () => {",
          "  run = await sut.action();",
          "});",
          "await then('the action fails with the exit code 3', async () => {",
          "  expect(run.exitCode).toBe(3);",
          '  expect(run.stdout).not.toContain("second");',
          "});",
        ],
      );
    },
  );

  await given('its system test runs sut.action and expects the exit code 3 without the output "second"', async () => {
    for (const [path, content] of Object.entries(module)) await sut.files.put(path, content);
  });

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

import { scenario } from "@opensoftware/testkit";
import { actionModule, testCases } from "./module.ts";

scenario("SCN-TK-041", async ({ sut, given, when, then }) => {
  let module: Record<string, string> = {};
  await given('a module whose composite action.yml writes "## demo" to the file in "GITHUB_STEP_SUMMARY"', async () => {
    module = actionModule(
      ["- shell: bash", "  run: |", '    echo "## demo" >> "$GITHUB_STEP_SUMMARY"'],
      ["When the workflow runs the action", 'Then the job summary is "## demo"'],
      [
        "let run: Awaited<ReturnType<typeof sut.action>>;",
        "await when('the workflow runs the action', async () => {",
        "  run = await sut.action();",
        "});",
        "await then('the job summary is \"## demo\"', async () => {",
        '  expect(run.summary).toBe("## demo\\n");',
        "});",
      ],
    );
  });

  await given('its system test runs sut.action and expects the job summary "## demo"', async () => {
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

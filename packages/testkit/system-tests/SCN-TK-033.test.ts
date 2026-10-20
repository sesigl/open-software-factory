import { scenario } from "@opensoftware/testkit";
import { actionModule, testCases } from "./module.ts";

scenario("SCN-TK-033", async ({ sut, given, when, then }) => {
  let module: Record<string, string> = {};
  await given(
    'a module whose composite action.yml has the input "name" and runs its "command" with it in a "run" step',
    async () => {
      module = actionModule(
        [
          "- id: greet",
          "  shell: bash",
          "  env:",
          "    NAME: ${{ inputs.name }}",
          "  run: |",
          '    greeting=$(${{ inputs.command }} "$NAME")',
          '    echo "$greeting"',
          '    echo "greeting=$greeting" >> "$GITHUB_OUTPUT"',
          "- uses: actions/upload-artifact@v4",
          "  with:",
          "    name: greeting",
          "    path: .",
        ],
        ["When the workflow runs the action", 'Then the output is "hello web"'],
        [
          "let run: Awaited<ReturnType<typeof sut.action>>;",
          "await when('the workflow runs the action', async () => {",
          '  run = await sut.action({ name: "web" });',
          "});",
          "await then('the output is \"hello web\"', async () => {",
          "  expect(run.exitCode, run.stderr).toBe(0);",
          '  expect(run.stdout).toContain("hello web");',
          '  expect(run.outputs).toEqual({ greeting: "hello web" });',
          '  expect(run.skipped).toEqual(["actions/upload-artifact@v4"]);',
          "});",
        ],
      );
    },
  );

  await given(
    'its system test runs sut.action with the input "name" set to "web" and expects the output "hello web" and the step output "greeting"',
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

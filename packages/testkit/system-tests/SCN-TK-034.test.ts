import { scenario } from "@opensoftware/testkit";
import { actionModule, testCases } from "./module.ts";

scenario("SCN-TK-034", async ({ sut, given, when, then }) => {
  let module: Record<string, string> = {};
  await given(
    'a module whose composite action.yml prints "GITHUB_EVENT_NAME" and the pull request number of the event in "GITHUB_EVENT_PATH"',
    async () => {
      module = actionModule(
        [
          "- shell: bash",
          "  run: |",
          "    number=$(node -p 'require(process.env.GITHUB_EVENT_PATH).pull_request.number')",
          '    echo "$GITHUB_EVENT_NAME $number"',
        ],
        ["When the workflow runs the action", 'Then the output is "pull_request 7"'],
        [
          "let run: Awaited<ReturnType<typeof sut.action>>;",
          "await when('the workflow runs the action', async () => {",
          "  run = await sut.action({}, { event: { pull_request: { number: 7 } } });",
          "});",
          "await then('the output is \"pull_request 7\"', async () => {",
          '  expect(run.stdout).toBe("pull_request 7\\n");',
          "});",
        ],
      );
    },
  );

  await given(
    'its system test runs sut.action with a pull request event of the number 7 and expects the output "pull_request 7"',
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

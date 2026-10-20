import { scenario } from "@opensoftware/testkit";
import { actionModule } from "./module.ts";

scenario("SCN-TK-035", async ({ sut, given, when, then }) => {
  let module: Record<string, string> = {};
  await given('a module whose composite action.yml runs "echo ${{ github.event.number }}"', async () => {
    module = actionModule(
      ["- shell: bash", "  run: echo ${{ github.event.number }}"],
      ["When the workflow runs the action", "Then the action succeeds"],
      [
        "let run: Awaited<ReturnType<typeof sut.action>>;",
        "await when('the workflow runs the action', async () => {",
        "  run = await sut.action({});",
        "});",
        "await then('the action succeeds', async () => {",
        "  expect(run.exitCode).toBe(0);",
        "});",
      ],
    );
  });

  await given("its system test runs sut.action", async () => {
    for (const [path, content] of Object.entries(module)) await sut.files.put(path, content);
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "testkit run --junit report.xml" in the module', async () => {
    run = await sut.cli(["run", "--junit", "report.xml"]);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode).toBe(1);
  });

  await then(
    'the output contains "sut.action supports only inputs.<name>, github.action_path and github.token: ${{ github.event.number }}"',
    async () => {
      expect(run.stdout + run.stderr).toContain(
        "sut.action supports only inputs.<name>, github.action_path and github.token: ${{ github.event.number }}",
      );
    },
  );
});

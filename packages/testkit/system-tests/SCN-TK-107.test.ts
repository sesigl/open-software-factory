import { scenario } from "@opensoftware/testkit";
import { sandboxModule, testCases } from "./module.ts";

scenario("SCN-TK-107", async ({ sut, given, when, then }) => {
  let module: Record<string, string> = {};
  await given(
    'a module whose CLI creates a sandbox with the adapter in "DEMO_SANDBOX_COMMAND", destroys it, prints the list, and runs "pwd" in it',
    async () => {
      module = sandboxModule(
        [
          'writeFileSync("spec.json", JSON.stringify({ template: "node:24" }));',
          'const id = sandbox("create", "spec.json").stdout.trim();',
          'sandbox("destroy", id);',
          'const list = sandbox("list").stdout;',
          'const pwd = sandbox("exec", id, "--", "pwd");',
          "process.stdout.write(`list: ${list}\\n${pwd.stderr}exit ${pwd.status}\\n`);",
        ],
        [
          'expect(run.stdout, run.stderr).toBe("list: \\nno sandbox 000000000001\\nexit 1\\n");',
          "expect(sandbox.list()).toEqual([]);",
        ],
      );
    },
  );

  await given('its system test expects an empty list, "no sandbox 000000000001" and the exit code 1', async () => {
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

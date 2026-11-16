import { scenario } from "@opensoftware/testkit";
import { sandboxModule, testCases } from "./module.ts";

scenario("SCN-TK-199", async ({ sut, given, when, then }) => {
  let module: Record<string, string> = {};
  await given(
    'a module whose CLI creates a sandbox with the label "osf.run" set to "run-1" and one with "run-2", with the adapter in "DEMO_SANDBOX_COMMAND", and prints "list --label osf.run=run-1"',
    async () => {
      module = sandboxModule(
        [
          'for (const run of ["run-1", "run-2"]) {',
          '  writeFileSync("spec.json", JSON.stringify({ template: "node:24", labels: { "osf.run": run } }));',
          '  sandbox("create", "spec.json");',
          "}",
          'process.stdout.write(sandbox("list", "--label", "osf.run=run-1").stdout);',
        ],
        ['expect(run.stdout, run.stderr).toBe("000000000001\\n");'],
      );
    },
  );

  await given('its system test expects "000000000001"', async () => {
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

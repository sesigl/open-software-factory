import { scenario } from "@opensoftware/testkit";
import { sandboxModule, testCases } from "./module.ts";

scenario("SCN-TK-108", async ({ sut, given, when, then }) => {
  let module: Record<string, string> = {};
  await given(
    'a module whose CLI creates a sandbox with the adapter in "DEMO_SANDBOX_COMMAND" from a spec with the template "node:24"',
    async () => {
      module = sandboxModule(
        [
          'writeFileSync("spec.json", JSON.stringify({ template: "node:24" }));',
          'const created = sandbox("create", "spec.json");',
          "process.stdout.write(`${created.stderr}exit ${created.status}\\n`);",
        ],
        [
          'expect(run.stdout, run.stderr).toBe("no template node:24\\nexit 1\\n");',
          "expect(sandbox.created()).toEqual([]);",
        ],
        '{ templates: ["alpine:3"] }',
      );
    },
  );

  await given(
    'its system test starts fakes.sandbox with the templates "alpine:3" and expects the exit code 1 and "no template node:24"',
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

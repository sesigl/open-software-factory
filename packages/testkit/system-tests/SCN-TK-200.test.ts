import { scenario } from "@opensoftware/testkit";
import { sandboxModule, testCases } from "./module.ts";

scenario("SCN-TK-200", async ({ sut, given, when, then }) => {
  let module: Record<string, string> = {};
  await given(
    'a module whose CLI creates a sandbox with the adapter in "DEMO_SANDBOX_COMMAND" and prints the list',
    async () => {
      module = sandboxModule(
        [
          'writeFileSync("spec.json", JSON.stringify({ template: "node:24" }));',
          'sandbox("create", "spec.json");',
          'process.stdout.write(sandbox("list").stdout);',
        ],
        [
          'expect(run.stdout, run.stderr).toBe("000000000001\\n000000000002\\n000000000003\\n");',
          'expect(sandbox.created().map(({ id }) => id)).toEqual(["000000000003"]);',
        ],
        '{ held: [{ template: "node:24", labels: { "osf.owner": "a" } }, { template: "node:24" }] }',
      );
    },
  );

  await given(
    'its system test starts fakes.sandbox with two sandboxes under "held" and expects "000000000001", "000000000002" and "000000000003", of which "created()" names only the last',
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

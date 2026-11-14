import { scenario } from "@opensoftware/testkit";
import { sandboxModule, testCases } from "./module.ts";

scenario("SCN-TK-150", async ({ sut, given, when, then }) => {
  let module: Record<string, string> = {};
  await given(
    'a module whose CLI runs "probe alpine:3 example.com" with the adapter in "DEMO_SANDBOX_COMMAND" and prints its output and the list',
    async () => {
      module = sandboxModule(
        [
          'const probe = sandbox("probe", "alpine:3", "example.com");',
          'process.stdout.write(`${probe.stdout}exit ${probe.status}\\nlist: ${sandbox("list").stdout}\\n`);',
        ],
        [
          'expect(run.stdout, run.stderr).toBe("refused example.com\\nexit 0\\nlist: \\n");',
          'expect(sandbox.probes()).toEqual([{ id: "000000000001", template: "alpine:3", host: "example.com" }]);',
          'expect(sandbox.created()).toEqual([{ id: "000000000001", spec: { template: "alpine:3", egress: [] } }]);',
          "expect(sandbox.list()).toEqual([]);",
        ],
      );
    },
  );

  await given(
    'its system test expects "refused example.com", an empty list and the probe of "alpine:3" and "example.com" in the fake',
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

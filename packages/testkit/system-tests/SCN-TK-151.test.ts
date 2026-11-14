import { scenario } from "@opensoftware/testkit";
import { sandboxModule, testCases } from "./module.ts";

scenario("SCN-TK-151", async ({ sut, given, when, then }) => {
  let module: Record<string, string> = {};
  await given(
    'a module whose CLI runs "probe alpine:3 example.com" with the adapter in "DEMO_SANDBOX_COMMAND"',
    async () => {
      module = sandboxModule(
        ['process.stdout.write(sandbox("probe", "alpine:3", "example.com").stdout);'],
        ['expect(run.stdout, run.stderr).toBe("reached example.com\\n");'],
        '{ probe: "reached" }',
      );
    },
  );

  await given(
    'its system test starts fakes.sandbox with the probe "reached" and expects "reached example.com"',
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

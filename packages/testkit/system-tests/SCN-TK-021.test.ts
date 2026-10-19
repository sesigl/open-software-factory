import { scenario } from "@opensoftware/testkit";
import { demoAdapter } from "./module.ts";

scenario("SCN-TK-021", async ({ sut, given, when, then }) => {
  let adapter: Record<string, string> = {};
  await given(
    'a port whose features have the implemented @conformance scenarios "SCN-DEMO-001" and "SCN-DEMO-002"',
    async () => {
      adapter = demoAdapter(["SCN-DEMO-001", "SCN-DEMO-002"], ["SCN-DEMO-001"]);
    },
  );

  await given('an adapter whose system tests pass "SCN-DEMO-001" and have no test for "SCN-DEMO-002"', async () => {
    for (const [path, content] of Object.entries(adapter)) await sut.files.put(path, content);
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "testkit conformance port/features --junit report.xml" in the adapter', async () => {
    run = await sut.cli(["conformance", "port/features", "--junit", "report.xml"]);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then('the output contains "CONFORMANCE SCN-DEMO-001 passed"', async () => {
    expect(run.stdout).toContain("CONFORMANCE SCN-DEMO-001 passed");
  });

  await then('the output contains "CONFORMANCE SCN-DEMO-002 has no system test"', async () => {
    expect(run.stdout).toContain("CONFORMANCE SCN-DEMO-002 has no system test");
  });

  await then('the output contains "1 of 2 conformance scenarios passed"', async () => {
    expect(run.stdout).toContain("1 of 2 conformance scenarios passed");
  });
});

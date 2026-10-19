import { scenario } from "@opensoftware/testkit";
import { demoAdapter } from "./module.ts";

scenario("SCN-TK-022", async ({ sut, given, when, then }) => {
  let adapter: Record<string, string> = {};
  await given(
    'a port whose features have the implemented @conformance scenarios "SCN-DEMO-001" and "SCN-DEMO-002"',
    async () => {
      adapter = demoAdapter(["SCN-DEMO-001", "SCN-DEMO-002"], ["SCN-DEMO-001", "SCN-DEMO-002"]);
    },
  );

  await given("an adapter whose system tests pass both", async () => {
    for (const [path, content] of Object.entries(adapter)) await sut.files.put(path, content);
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "testkit conformance port/features --junit report.xml" in the adapter', async () => {
    run = await sut.cli(["conformance", "port/features", "--junit", "report.xml"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then('the output contains "2 of 2 conformance scenarios passed"', async () => {
    expect(run.stdout).toContain("2 of 2 conformance scenarios passed");
  });
});

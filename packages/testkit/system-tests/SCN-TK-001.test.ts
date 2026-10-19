import { scenario } from "@opensoftware/testkit";
import { demoModule } from "./module.ts";

scenario("SCN-TK-001", async ({ sut, given, when, then }) => {
  await given('a module with the implemented scenario "SCN-DEMO-001" and its passing system test', async () => {
    for (const [path, content] of Object.entries(demoModule())) await sut.files.put(path, content);
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "testkit run --junit report.xml" in the module', async () => {
    run = await sut.cli(["run", "--junit", "report.xml"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then(
    '"report.xml" has a test case named "SCN-DEMO-001" with the property "scenario" set to "SCN-DEMO-001"',
    async () => {
      const report = await sut.files.read("report.xml");
      expect(report).toMatch(
        /<testcase [^>]*name="SCN-DEMO-001"[^>]*>\s*<properties>\s*<property name="scenario" value="SCN-DEMO-001">/,
      );
    },
  );
});

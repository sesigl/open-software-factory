import { scenario } from "@opensoftware/testkit";
import { testCases } from "./module.ts";
import { CLOCK, clockTest, siteModule } from "./site.ts";

scenario("SCN-TK-187", async ({ sut, given, when, then }) => {
  let module: Record<string, string> = {};
  await given(
    'a library whose folder "site" holds a page with an external script, instrumented as Stryker 10 emits it, that shows "morning", and "afternoon" while the mutant "7" is active',
    async () => {
      const { steps, test } = clockTest("afternoon");
      module = siteModule(CLOCK, steps, test);
    },
  );

  await given(
    `its system test serves "site" with sut.site and the header "Content-Security-Policy: script-src 'self'", opens "/" with sut.browser and expects the status "afternoon"`,
    async () => {
      for (const [path, content] of Object.entries(module)) await sut.files.put(path, content);
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when(
    'the developer runs "testkit run --junit report.xml" in the module with "__STRYKER_ACTIVE_MUTANT__" set to "7"',
    async () => {
      run = await sut.cli(["run", "--junit", "report.xml"], { env: { __STRYKER_ACTIVE_MUTANT__: "7" } });
    },
  );

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

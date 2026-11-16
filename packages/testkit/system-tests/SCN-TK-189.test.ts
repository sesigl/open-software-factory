import { scenario } from "@opensoftware/testkit";
import { testCases } from "./module.ts";
import { siteModule, TIMER, timerTest } from "./site.ts";

scenario("SCN-TK-189", async ({ sut, given, when, then }) => {
  let module: Record<string, string> = {};
  await given(
    'a library whose folder "site" holds a page with an external script that shows "waiting", and "done" one second later',
    async () => {
      const { steps, test } = timerTest();
      module = siteModule(TIMER, steps, test);
    },
  );

  await given(
    'its system test serves "site" with sut.site, opens "/" with sut.browser and the clock "paused", and expects "waiting", "waiting" after 999 milliseconds of page.clock.runFor, and "done" after one more',
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

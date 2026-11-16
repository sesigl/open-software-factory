import { scenario } from "@opensoftware/testkit";
import { budgetedDemo, junit, putAll, runTime } from "./repo.ts";

scenario("SCN-REPO-183", async ({ sut, given, when, then }) => {
  await given('a repository whose module "demo" has a budget of 10 seconds of wall time', async () => {
    await putAll(sut, budgetedDemo("- System tests: 10 seconds of wall time on the CI runner."));
  });

  await given(
    'a JUnit report in which the system tests of "demo" took 30 seconds together, in a run of 8 seconds of wall time',
    async () => {
      // Three tests of 10 s each that ran side by side in workers of their own.
      const tests = ["SCN-DEMO-001", "SCN-DEMO-002", "SCN-DEMO-003"].map((id) => ({
        file: `modules/demo/system-tests/${id}.test.ts`,
        id,
        time: 10,
      }));
      await putAll(sut, { "reports/junit/demo.xml": junit(tests), ...runTime(8) });
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "osf check BUDGET"', async () => {
    run = await sut.cli(["check", "BUDGET"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });
});

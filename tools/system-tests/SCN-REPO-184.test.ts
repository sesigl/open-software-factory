import { scenario } from "@opensoftware/testkit";
import { budgetedDemo, DEMO_TEST, junit, putAll } from "./repo.ts";

scenario("SCN-REPO-184", async ({ sut, given, when, then }) => {
  await given('a repository whose module "demo" has a budget of 10 seconds of wall time', async () => {
    await putAll(sut, budgetedDemo("- System tests: 10 seconds of wall time on the CI runner."));
  });

  await given('a JUnit report of the system tests of "demo" without a wall time for their run', async () => {
    await putAll(sut, { "reports/junit/demo.xml": junit([{ file: DEMO_TEST, id: "SCN-DEMO-001", time: 2 }]) });
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "osf check BUDGET"', async () => {
    run = await sut.cli(["check", "BUDGET"]);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then(
    'the output contains "BUDGET modules/demo/AGENTS.md:5" and "no wall time of the run of the system tests"',
    async () => {
      expect(run.stdout).toContain("BUDGET modules/demo/AGENTS.md:5");
      expect(run.stdout).toContain("no wall time of the run of the system tests");
    },
  );
});

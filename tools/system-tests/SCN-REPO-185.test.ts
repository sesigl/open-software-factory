import { scenario } from "@opensoftware/testkit";
import { budgetedDemo, putAll } from "./repo.ts";

scenario("SCN-REPO-185", async ({ sut, given, when, then }) => {
  await given(
    'a repository whose module "demo" has a budget of 10 seconds of wall time and three more lines about it',
    async () => {
      await putAll(
        sut,
        budgetedDemo(
          "- System tests: 10 seconds of wall time on the CI runner.",
          "- Raised from 8 s on 2026-11-01: SCN-DEMO-002 starts a database.",
          "",
          "- Before that: raised from 6 s on 2026-10-01, measured on the development container",
          "  while another suite ran.",
        ),
      );
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "osf check BUDGET"', async () => {
    run = await sut.cli(["check", "BUDGET"]);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then(
    'the output contains "BUDGET modules/demo/AGENTS.md:3 the budget section has 4 lines, at most 3"',
    async () => {
      expect(run.stdout).toContain("BUDGET modules/demo/AGENTS.md:3 the budget section has 4 lines, at most 3");
    },
  );
});

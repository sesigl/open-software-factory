import { type CliResult, scenario } from "@opensoftware/testkit";
import { junitReport, report } from "./released.ts";

scenario("SCN-REPO-221", async ({ sut, given, when, then }) => {
  await given(
    'the JUnit report "deploy/reports/junit.xml" in which "SCN-DIST-026" and "SCN-DIST-041" failed, "SCN-DIST-002" passed and "SCN-DIST-003" was skipped',
    async () => {
      await junitReport(sut, "deploy/reports/junit.xml", [
        ["SCN-DIST-041", "failed"],
        ["SCN-DIST-002", "passed"],
        ["SCN-DIST-026", "failed"],
        ["SCN-DIST-003", "skipped"],
      ]);
    },
  );

  let run: CliResult;
  await when(
    'the developer runs "osf released-images report deploy/reports/junit.xml --run https://github.com/acme/factory/actions/runs/7 --ref 1a2b3c4"',
    async () => {
      run = await report(sut, "deploy/reports/junit.xml");
    },
  );

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then(
    'the output names the run "https://github.com/acme/factory/actions/runs/7" and the commit "1a2b3c4"',
    async () => {
      expect(run.stdout).toContain(
        "The deploy scenarios failed on the released images of 1a2b3c4: https://github.com/acme/factory/actions/runs/7",
      );
    },
  );

  await then(
    'the output has the lines "- SCN-DIST-026" and "- SCN-DIST-041" and names neither "SCN-DIST-002" nor "SCN-DIST-003"',
    async () => {
      const lines = run.stdout.split("\n");
      expect(lines.filter((line) => line.startsWith("- "))).toEqual(["- SCN-DIST-026", "- SCN-DIST-041"]);
      expect(run.stdout).not.toMatch(/SCN-DIST-002|SCN-DIST-003/);
    },
  );
});

import { type CliResult, scenario } from "@opensoftware/testkit";
import { junitReport, RUN, report } from "./released.ts";

scenario("SCN-REPO-222", async ({ sut, given, when, then }) => {
  await given(
    'no file "deploy/reports/junit.xml", and the JUnit report "passed.xml" in which "SCN-DIST-002" passed',
    async () => {
      await junitReport(sut, "passed.xml", [["SCN-DIST-002", "passed"]]);
    },
  );

  let missing: CliResult;
  let passed: CliResult;
  await when(
    'the developer runs "osf released-images report deploy/reports/junit.xml --run https://github.com/acme/factory/actions/runs/7 --ref 1a2b3c4", and again with "passed.xml"',
    async () => {
      missing = await report(sut, "deploy/reports/junit.xml");
      passed = await report(sut, "passed.xml");
    },
  );

  await then("both runs exit with code 0", async () => {
    expect(missing.exitCode, missing.stdout + missing.stderr).toBe(0);
    expect(passed.exitCode, passed.stdout + passed.stderr).toBe(0);
  });

  await then(
    'each output names the run and contains "No scenario failed: a step before or after the scenarios failed, like the pull of a released image"',
    async () => {
      const text = "No scenario failed: a step before or after the scenarios failed, like the pull of a released image";
      expect(missing.stdout).toContain(RUN);
      expect(missing.stdout).toContain(text);
      expect(passed.stdout).toContain(RUN);
      expect(passed.stdout).toContain(text);
      expect(passed.stdout).not.toContain("SCN-DIST-002");
    },
  );
});

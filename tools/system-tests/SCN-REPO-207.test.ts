import { scenario } from "@opensoftware/testkit";
import { budgetedModule, jobsOf, suite, suitesFile } from "./suites.ts";

scenario("SCN-REPO-207", async ({ sut, given, when, then }) => {
  await given('the suite "a" of ".github/test-suites.yml"', async () => {
    await budgetedModule(sut, "a", 45);
    await suitesFile(sut, [suite("a")]);
  });

  let first: Awaited<ReturnType<typeof sut.cli>>;
  let second: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "osf suite-plan a gone" and then "osf suite-plan" without a suite', async () => {
    first = await sut.cli(["suite-plan", "a", "gone"]);
    second = await sut.cli(["suite-plan"]);
  });

  await then(
    'the first run exits with code 1 and its error output contains "osf suite-plan: no suite gone in .github/test-suites.yml"',
    async () => {
      expect(first.exitCode, first.stdout + first.stderr).toBe(1);
      expect(first.stderr).toContain("osf suite-plan: no suite gone in .github/test-suites.yml");
    },
  );

  await then("the second run exits with code 0 and prints an empty list of jobs", async () => {
    expect(second.exitCode, second.stdout + second.stderr).toBe(0);
    expect(jobsOf(second.stdout)).toEqual([]);
  });
});

import { scenario } from "@opensoftware/testkit";
import { budgetedModule, jobsOf, type Suite, suite, suitesFile } from "./suites.ts";

scenario("SCN-REPO-205", async ({ sut, given, when, then }) => {
  const suites: Suite[] = [suite("a"), suite("b"), suite("c"), suite("d"), suite("big")];
  await given(
    'the suites "a", "b", "c" and "d" of ".github/test-suites.yml", whose modules have budgets of 45, 45, 50 and 60 seconds, and the suite "big", whose module has a budget of 200 seconds',
    async () => {
      for (const [name, budget] of [
        ["a", 45],
        ["b", 45],
        ["c", 50],
        ["d", 60],
        ["big", 200],
      ] as const) {
        await budgetedModule(sut, name, budget);
      }
      await suitesFile(sut, suites);
    },
  );

  await given(
    'the suite "a" names the fake "postgres", and the suite "c" names the fake "forge" and "browser: chromium"',
    async () => {
      Object.assign(suites[0] as Suite, { images: "postgres" });
      Object.assign(suites[2] as Suite, { images: "forge", browser: "chromium" });
      await suitesFile(sut, suites);
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "osf suite-plan --all"', async () => {
    run = await sut.cli(["suite-plan", "--all"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then('the output lists the jobs "a+c", "b+d" and "big"', async () => {
    expect(jobsOf(run.stdout).map((job) => job.suite)).toEqual(["a+c", "b+d", "big"]);
  });

  await then(
    'the job "a+c" runs the filter "@opensoftware/a @opensoftware/c" with the images "postgres forge" and "browser: chromium"',
    async () => {
      expect(jobsOf(run.stdout)[0]).toEqual({
        suite: "a+c",
        filter: "@opensoftware/a @opensoftware/c",
        images: "postgres forge",
        browser: "chromium",
      });
    },
  );
});

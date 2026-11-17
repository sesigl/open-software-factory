import { scenario } from "@opensoftware/testkit";
import { budgetedModule, jobsOf, type Suite, suite, suitesFile } from "./suites.ts";

scenario("SCN-REPO-206", async ({ sut, given, when, then }) => {
  const suites: Suite[] = [];
  await given(
    'the suites "a" and "kube" of ".github/test-suites.yml", whose modules have budgets of 45 seconds, and the suite "kube" sets "kind: true"',
    async () => {
      await budgetedModule(sut, "a", 45);
      await budgetedModule(sut, "kube", 45);
      suites.push(suite("a", { images: "postgres" }), suite("kube", { kind: true }));
      await suitesFile(sut, suites);
    },
  );

  await given(
    'the suite "open", whose module has no budget, and the suite "rest" with the filter "!@opensoftware/a !@opensoftware/kube !@opensoftware/open", whose module has a budget of 45 seconds',
    async () => {
      await budgetedModule(sut, "open", undefined);
      await budgetedModule(sut, "rest", 45);
      suites.push(suite("open"), {
        suite: "rest",
        filter: "!@opensoftware/a !@opensoftware/kube !@opensoftware/open",
      });
      await suitesFile(sut, suites);
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "osf suite-plan a kube open rest"', async () => {
    run = await sut.cli(["suite-plan", "a", "kube", "open", "rest"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then(
    'the output lists the jobs "a", "kube", "open" and "rest", each as the suite\'s own entry of ".github/test-suites.yml"',
    async () => {
      expect(jobsOf(run.stdout)).toEqual(suites);
    },
  );
});

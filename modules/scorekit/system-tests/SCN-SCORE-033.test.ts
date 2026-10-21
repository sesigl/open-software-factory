import { scenario } from "@opensoftware/testkit";
import { readEntries } from "./evaluators.ts";

scenario("SCN-SCORE-033", async ({ sut, when, then }) => {
  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "scorekit export"', async () => {
    run = await sut.cli(["export"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then(
    '"evaluators.json" holds the evaluators "change-requested", "needless-human-question", "redundant-tests", "scope-creep" and "skipped-checks"',
    async () => {
      const entries = await readEntries(sut);
      expect(entries.map((entry) => entry.evaluator.name)).toEqual([
        "change-requested",
        "needless-human-question",
        "redundant-tests",
        "scope-creep",
        "skipped-checks",
      ]);
      for (const entry of entries) expect(entry.evaluator.type).toBe("llm_as_judge");
    },
  );

  await then('the output says "wrote 5 evaluators to"', async () => {
    expect(run.stdout).toContain("wrote 5 evaluators to");
  });
});

import { scenario } from "@opensoftware/testkit";
import { entryOf, readEntries } from "./evaluators.ts";

scenario("SCN-SCORE-037", async ({ sut, when, then }) => {
  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "scorekit export --scorer redundant-tests"', async () => {
    run = await sut.cli(["export", "--scorer", "redundant-tests"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then('the evaluator "redundant-tests" has no model', async () => {
    const entries = await readEntries(sut);
    expect(entries).toHaveLength(1);
    expect(entryOf(entries, "redundant-tests").evaluator.modelConfig).toBeNull();
  });
});

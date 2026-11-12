import { scenario } from "@opensoftware/testkit";
import { IMPLEMENT, newRunOf, PLAN, RUN_BEFORE, reviewAdded, started } from "./foreman.ts";

const LINK = "https://github.com/tester/web/pull/7";

scenario("SCN-FORE-109", async ({ sut, fakes, given, when, then }) => {
  let run: Awaited<ReturnType<typeof started>>;
  await given(
    'the server ran the README\'s "work.json" with "OSF_DATA" set to "$OUTPUT/foreman", the "plan" turn wrote "plan.md" and replied with the link "https://github.com/tester/web/pull/7", and the "implement" turn ended with "refusal"',
    async () => {
      run = await started(sut, fakes, {
        turns: [
          // The new run's "plan" turn waits, so the scenario sees where it starts.
          { when: RUN_BEFORE, waitsFor: "never" },
          { when: PLAN, edits: { "plan.md": "the plan\n" }, reply: `Opened ${LINK}` },
          { when: IMPLEMENT, stopReason: "refusal" },
        ],
        env: { OSF_DATA: sut.files.path("$OUTPUT/foreman") },
      });
      await run.until(run.runId, "failed");
    },
  );

  await given(
    'a new commit adds the stage "review" to "factory.yaml", so the stage names in order are no longer those of the run',
    async () => {
      await reviewAdded(sut, fakes);
    },
  );

  let answer: Awaited<ReturnType<typeof run.retry>>;
  await when('"github:ada" posts a retry of the run to "/v1/runs/<id>/retry"', async () => {
    answer = await run.retry(run.runId);
  });

  let newId = "";
  await then(
    'the answer has the status 201 with the stages "plan", "implement" and "review" "pending" and the pull request "https://github.com/tester/web/pull/7"',
    async () => {
      newId = newRunOf(answer);
      expect(answer.data?.stages).toEqual([
        { stage: "plan", agent: "plan", state: "pending" },
        { stage: "implement", agent: "implement", state: "pending" },
        { stage: "review", agent: "review", state: "pending" },
      ]);
      expect(answer.data?.pullRequest).toBe(LINK);
    },
  );

  await then(
    'the "plan" prompt of the new run has the line "Run before: <id> failed in the stage implement"',
    async () => {
      await expect.poll(() => run.prompts(PLAN)).toHaveLength(2);
      expect(run.prompts(PLAN)[1]).toContain(`\n\nRun before: ${run.runId} failed in the stage implement\n`);
    },
  );

  await then(
    'the "plan" turn of the new run ran in "$OUTPUT/foreman/runs/<new id>", which holds the "plan.md" of the run before',
    async () => {
      expect(run.harness.sessions().map(({ cwd }) => cwd)[2]).toBe(sut.files.path(`$OUTPUT/foreman/runs/${newId}`));
      expect(await sut.files.read(`$OUTPUT/foreman/runs/${newId}/plan.md`)).toBe("the plan\n");
    },
  );
});

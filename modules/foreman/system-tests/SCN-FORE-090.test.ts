import { scenario } from "@opensoftware/testkit";
import { IMPLEMENT, newRunOf, PLAN, started } from "./foreman.ts";

scenario("SCN-FORE-090", async ({ sut, fakes, given, when, then }) => {
  let run: Awaited<ReturnType<typeof started>>;
  await given(
    'a run whose stage "implement" runs a turn that waits for "never", and a person posted the signal "cancel"',
    async () => {
      run = await started(sut, fakes, {
        turns: [
          { when: PLAN, reply: "plan.md is written" },
          { when: IMPLEMENT, waitsFor: "never" },
          { when: IMPLEMENT, waitsFor: "never" },
        ],
      });
      await run.untilStage(run.runId, 1, "running");
      await run.signal(run.runId, { type: "cancel" });
      await run.until(run.runId, "cancelled");
    },
  );

  let newId = "";
  await when('"github:ada" posts a retry of the run to "/v1/runs/<id>/retry"', async () => {
    newId = newRunOf(await run.retry(run.runId));
  });

  await then('"/v1/runs/<new id>" shows the stage "plan" "succeeded" and the stage "implement" "running"', async () => {
    const view = await run.untilStage(newId, 1, "running");
    expect(view.stages.map(({ stage, state }) => ({ stage, state }))).toEqual([
      { stage: "plan", state: "succeeded" },
      { stage: "implement", state: "running" },
    ]);
    expect(run.prompts(PLAN)).toHaveLength(1);
  });
});

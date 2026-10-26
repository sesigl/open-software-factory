import { scenario } from "@opensoftware/testkit";
import { IMPLEMENT, PLAN, started } from "./foreman.ts";

scenario("SCN-FORE-063", async ({ sut, fakes, given, when, then }) => {
  let run: Awaited<ReturnType<typeof started>>;
  await given('a person took over the stage "implement" of a run', async () => {
    run = await started(sut, fakes, { turns: [{ when: PLAN }, { when: IMPLEMENT, waitsFor: "never" }] });
    await run.untilStage(run.runId, 1, "running");
    await run.signal(run.runId, { type: "take-over" });
    await run.untilStage(run.runId, 1, "blocked");
  });

  await when('a person posts the signal "cancel"', async () => {
    await run.signal(run.runId, { type: "cancel" });
  });

  await then('"/v1/runs/<id>" shows the state "cancelled" with the stage "implement" "cancelled"', async () => {
    const view = await run.until(run.runId, "cancelled");
    expect(view.stages.map(({ stage, state }) => ({ stage, state }))).toEqual([
      { stage: "plan", state: "succeeded" },
      { stage: "implement", state: "cancelled" },
    ]);
  });
});

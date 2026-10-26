import { scenario } from "@opensoftware/testkit";
import { IMPLEMENT, PLAN, started } from "./foreman.ts";

scenario("SCN-FORE-017", async ({ sut, fakes, given, when, then }) => {
  let run: Awaited<ReturnType<typeof started>>;
  await given('a run whose stage "implement" runs a turn that waits for "never"', async () => {
    run = await started(sut, fakes, { turns: [{ when: PLAN }, { when: IMPLEMENT, waitsFor: "never" }] });
    await run.untilStage(run.runId, 1, "running");
  });

  let answer: Awaited<ReturnType<typeof run.signal>>;
  await when('a person posts the signal "cancel"', async () => {
    answer = await run.signal(run.runId, { type: "cancel" });
  });

  await then("the answer has the status 202", async () => {
    expect(answer.response.status).toBe(202);
  });

  await then('"/v1/runs/<id>" shows the state "cancelled" with the stage "implement" "cancelled"', async () => {
    const view = await run.until(run.runId, "cancelled");
    expect(view.stages.map(({ stage, state }) => ({ stage, state }))).toEqual([
      { stage: "plan", state: "succeeded" },
      { stage: "implement", state: "cancelled" },
    ]);
  });
});

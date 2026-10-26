import { scenario } from "@opensoftware/testkit";
import { IMPLEMENT, PLAN, started } from "./foreman.ts";

const MESSAGE = "use the existing date helper";

scenario("SCN-FORE-016", async ({ sut, fakes, given, when, then }) => {
  let run: Awaited<ReturnType<typeof started>>;
  await given(`a run whose stage "implement" runs a turn that waits for "${MESSAGE}"`, async () => {
    run = await started(sut, fakes, { turns: [{ when: PLAN }, { when: IMPLEMENT, waitsFor: MESSAGE }] });
    await run.untilStage(run.runId, 1, "running");
  });

  let answer: Awaited<ReturnType<typeof run.signal>>;
  await when(`a person posts the signal "steer" with the message "${MESSAGE}"`, async () => {
    answer = await run.signal(run.runId, { type: "steer", message: MESSAGE });
  });

  await then("the answer has the status 202", async () => {
    expect(answer.response.status).toBe(202);
    expect(answer.data?.runId).toBe(run.runId);
  });

  await then(`the agent received the steering message "${MESSAGE}"`, async () => {
    await run.until(run.runId, "complete");
    expect(run.harness.prompts().at(-1)).toBe(MESSAGE);
  });

  await then('"/v1/runs/<id>" shows the state "complete"', async () => {
    expect((await run.view(run.runId)).stages[1]).toMatchObject({ stage: "implement", state: "succeeded" });
  });
});

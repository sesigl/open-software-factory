import { scenario } from "@opensoftware/testkit";
import { IMPLEMENT, PLAN, started } from "./foreman.ts";

scenario("SCN-FORE-062", async ({ sut, fakes, given, when, then }) => {
  let run: Awaited<ReturnType<typeof started>>;
  await given('a run whose stage "implement" runs a turn that waits for "never"', async () => {
    run = await started(sut, fakes, { turns: [{ when: PLAN }, { when: IMPLEMENT, waitsFor: "never" }] });
    await run.untilStage(run.runId, 1, "running");
  });

  let answer: Awaited<ReturnType<typeof run.signal>>;
  await when('a person posts the signal "hand-back"', async () => {
    answer = await run.signal(run.runId, { type: "hand-back" });
  });

  await then("the answer has the status 409 and a problem that says nobody took over the run", async () => {
    expect(answer.response.status).toBe(409);
    expect(answer.error).toMatchObject({ status: 409, detail: `nobody took over ${run.runId}` });
    expect((await run.view(run.runId)).stages[1]?.state).toBe("running");
  });
});

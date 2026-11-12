import { scenario } from "@opensoftware/testkit";
import { IMPLEMENT, PLAN, started } from "./foreman.ts";

scenario("SCN-FORE-095", async ({ sut, fakes, given, when, then }) => {
  let run: Awaited<ReturnType<typeof started>>;
  await given('a run whose stage "implement" runs a turn that waits for "never"', async () => {
    run = await started(sut, fakes, {
      turns: [
        { when: PLAN, reply: "plan.md is written" },
        { when: IMPLEMENT, waitsFor: "never" },
      ],
    });
    await run.untilStage(run.runId, 1, "running");
  });

  let answer: Awaited<ReturnType<typeof run.retry>>;
  await when('"github:ada" posts a retry of the run to "/v1/runs/<id>/retry"', async () => {
    answer = await run.retry(run.runId);
  });

  await then('the answer has the status 409 and a problem that names the state "running"', async () => {
    expect(answer.response.status).toBe(409);
    expect(answer.error).toEqual({
      title: "The run does not run again",
      status: 409,
      detail: `${run.runId} is running`,
    });
  });

  await then('"/v1/runs" lists one run', async () => {
    expect((await run.list()).data?.runs.map(({ runId }) => runId)).toEqual([run.runId]);
  });
});

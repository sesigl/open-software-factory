import { scenario } from "@opensoftware/testkit";
import { PLAN, readmeWork, started } from "./foreman.ts";

scenario("SCN-FORE-003", async ({ sut, fakes, given, when, then }) => {
  let run: Awaited<ReturnType<typeof started>>;
  await given('the server completed a run of the README\'s "work.json"', async () => {
    run = await started(sut, fakes);
    await run.until(run.runId, "complete");
  });

  let answer: Awaited<ReturnType<typeof run.start>>;
  await when('a program posts the README\'s "work.json" to "/v1/runs" again', async () => {
    answer = await run.start(readmeWork(fakes));
  });

  await then("the answer has the status 200 and the same run ID", async () => {
    expect(answer.response.status).toBe(200);
    expect(answer.data).toMatchObject({ runId: run.runId, state: "complete" });
  });

  await then('the harness received the prompt "Write a plan" only once', async () => {
    expect(run.prompts(PLAN)).toHaveLength(1);
  });
});

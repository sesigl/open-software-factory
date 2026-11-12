import { scenario } from "@opensoftware/testkit";
import { started } from "./foreman.ts";

scenario("SCN-FORE-096", async ({ sut, fakes, given, when, then }) => {
  let run: Awaited<ReturnType<typeof started>>;
  await given('the server completed a run of the README\'s "work.json"', async () => {
    run = await started(sut, fakes);
    await run.until(run.runId, "complete");
  });

  let answer: Awaited<ReturnType<typeof run.retry>>;
  await when('"github:ada" posts a retry of the run to "/v1/runs/<id>/retry"', async () => {
    answer = await run.retry(run.runId);
  });

  await then('the answer has the status 409 and a problem that names the state "complete"', async () => {
    expect(answer.response.status).toBe(409);
    expect(answer.error).toMatchObject({ status: 409, detail: `${run.runId} is complete` });
  });
});

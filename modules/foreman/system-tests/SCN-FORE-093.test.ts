import { scenario } from "@opensoftware/testkit";
import { ADA, PLAN, started } from "./foreman.ts";

scenario("SCN-FORE-093", async ({ sut, fakes, given, when, then }) => {
  let run: Awaited<ReturnType<typeof started>>;
  await given('the server ran the README\'s "work.json" and the "plan" turn ended with "refusal"', async () => {
    run = await started(sut, fakes, { turns: [{ when: PLAN, stopReason: "refusal" }] });
    await run.until(run.runId, "failed");
  });

  let answer: Awaited<ReturnType<typeof run.retry>>;
  await when('"github:ada" posts a retry of the run from the stage "implement"', async () => {
    answer = await run.retry(run.runId, { by: ADA, from: "implement" });
  });

  await then('the answer has the status 400 and a problem that names "from" and the stage "plan"', async () => {
    expect(answer.response.status).toBe(400);
    expect(answer.error).toEqual({
      title: "Bad request",
      status: 400,
      detail: `from: "implement" is no stage at or before the stage plan, the first stage of ${run.runId} that did not succeed`,
    });
  });
});

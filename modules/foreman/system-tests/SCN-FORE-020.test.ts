import { scenario } from "@opensoftware/testkit";
import { started } from "./foreman.ts";

scenario("SCN-FORE-020", async ({ sut, fakes, given, when, then }) => {
  let run: Awaited<ReturnType<typeof started>>;
  await given('the server completed a run of the README\'s "work.json"', async () => {
    run = await started(sut, fakes);
    await run.until(run.runId, "complete");
  });

  let answer: Awaited<ReturnType<typeof run.signal>>;
  await when('a person posts the signal "pause"', async () => {
    answer = await run.signal(run.runId, { type: "pause" });
  });

  await then('the answer has the status 400 and a problem that names "type"', async () => {
    expect(answer.response.status).toBe(400);
    expect(answer.error).toMatchObject({ status: 400, detail: expect.stringContaining("/type") });
  });
});

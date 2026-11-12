import { scenario } from "@opensoftware/testkit";
import { failed, newRunOf, readmeWork } from "./foreman.ts";

scenario("SCN-FORE-101", async ({ sut, fakes, given, when, then }) => {
  let run: Awaited<ReturnType<typeof failed>>;
  let newId = "";
  await given(
    'the server ran the README\'s "work.json", the "implement" turn ended with "refusal", and "github:ada" retried the run',
    async () => {
      run = await failed(sut, fakes);
      newId = newRunOf(await run.retry(run.runId));
    },
  );

  let answer: Awaited<ReturnType<typeof run.start>>;
  await when('a program posts the README\'s "work.json" to "/v1/runs" again', async () => {
    answer = await run.start(readmeWork(fakes));
  });

  await then('the answer has the status 200 and the run ID "<new id>"', async () => {
    expect(answer.response.status).toBe(200);
    expect(answer.data).toMatchObject({ runId: newId, attempt: 2, retryOf: run.runId });
  });
});

import { scenario } from "@opensoftware/testkit";
import { failed, newRunOf } from "./foreman.ts";

scenario("SCN-FORE-100", async ({ sut, fakes, given, when, then }) => {
  let run: Awaited<ReturnType<typeof failed>>;
  let newId = "";
  await given(
    'the server ran the README\'s "work.json", the "implement" turn ended with "refusal", and "github:ada" retried the run',
    async () => {
      run = await failed(sut, fakes);
      newId = newRunOf(await run.retry(run.runId));
      await run.until(newId, "complete");
    },
  );

  let answer: Awaited<ReturnType<typeof run.list>>;
  await when('a program reads "/v1/runs" with the API token', async () => {
    answer = await run.list();
  });

  await then(
    'the list has the new run in the state "complete" with the attempt 2, and then the run before in the state "failed"',
    async () => {
      expect(answer.data?.runs.map(({ runId, state, attempt }) => ({ runId, state, attempt }))).toEqual([
        { runId: newId, state: "complete", attempt: 2 },
        { runId: run.runId, state: "failed", attempt: undefined },
      ]);
    },
  );
});

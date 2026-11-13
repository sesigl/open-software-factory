import { scenario } from "@opensoftware/testkit";
import { failedWithEvents, newRunOf, WAIT_MS } from "./foreman.ts";

scenario("SCN-FORE-102", async ({ sut, fakes, given, when, then }) => {
  let run: Awaited<ReturnType<typeof failedWithEvents>>;
  await given(
    '"foreman serve" runs the README\'s "factory.yaml" with "FOREMAN_NATS_URL" set to a NATS server, and its run of the README\'s "work.json" failed in the stage "implement"',
    async () => {
      run = await failedWithEvents(sut, fakes);
    },
  );

  let newId = "";
  await when('"github:ada" posts a retry of the run to "/v1/runs/<id>/retry"', async () => {
    newId = newRunOf(await run.retry(run.runId));
  });

  await then(
    'the server publishes "run.started@v1" with the ID "<new id>.started" and the "retryOf" "<id>"',
    async () => {
      const [started] = await run.events.received("run.started@v1", { timeoutMs: WAIT_MS });
      expect(started?.id).toBe(`${newId}.started`);
      expect(started?.data).toMatchObject({ runId: newId, retryOf: run.runId });
    },
  );

  await then(
    'then "run.completed@v1" with the ID "<new id>.completed", the outcome "succeeded" and the "retryOf" "<id>"',
    async () => {
      const [completed] = await run.events.received("run.completed@v1", { timeoutMs: WAIT_MS });
      expect(completed?.id).toBe(`${newId}.completed`);
      expect(completed?.data).toMatchObject({ runId: newId, outcome: "succeeded", retryOf: run.runId });
    },
  );
});

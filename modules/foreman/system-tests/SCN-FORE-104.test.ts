import { scenario } from "@opensoftware/testkit";
import { failedWithEvents, retryRequested, WAIT_MS } from "./foreman.ts";

scenario("SCN-FORE-104", async ({ sut, fakes, given, when, then }) => {
  let run: Awaited<ReturnType<typeof failedWithEvents>>;
  await given(
    '"foreman serve" runs the README\'s "factory.yaml" with "FOREMAN_NATS_URL" set to a NATS server, and its run of the README\'s "work.json" failed in the stage "implement"',
    async () => {
      run = await failedWithEvents(sut, fakes);
    },
  );

  await when('intake publishes "work.retry-requested@v1" for the run with the requester "github:tester"', async () => {
    await run.events.publish("osf.work.retry-requested.v1", retryRequested(fakes, run.runId));
  });

  let newId = "";
  await then('the server publishes "run.started@v1" of a new run with the "retryOf" "<id>"', async () => {
    const [started] = await run.events.received("run.started@v1", { timeoutMs: WAIT_MS });
    newId = (started?.data as { runId: string } | undefined)?.runId as string;
    expect(newId).not.toBe(run.runId);
    expect(started?.data).toMatchObject({ retryOf: run.runId });
  });

  await then('"/v1/runs/<new id>" names the person "github:tester" who retried it', async () => {
    expect((await run.view(newId)).retriedBy).toEqual({ kind: "person", id: "github:tester" });
  });
});

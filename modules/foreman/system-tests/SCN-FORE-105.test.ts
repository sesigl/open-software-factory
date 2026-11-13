import { scenario } from "@opensoftware/testkit";
import { failedWithEvents, retryRequested, WAIT_MS } from "./foreman.ts";

scenario("SCN-FORE-105", async ({ sut, fakes, given, when, then }) => {
  let run: Awaited<ReturnType<typeof failedWithEvents>>;
  let newId = "";
  await given(
    'the foreman ran the README\'s "work.json" again after intake\'s "work.retry-requested@v1" for its failed run',
    async () => {
      run = await failedWithEvents(sut, fakes);
      await run.events.publish("osf.work.retry-requested.v1", retryRequested(fakes, run.runId));
      const [started] = await run.events.received("run.started@v1", { timeoutMs: WAIT_MS });
      newId = (started?.data as { runId: string } | undefined)?.runId as string;
      await run.until(newId, "complete");
    },
  );

  // The test's publish carries no message ID, so JetStream does not drop it, as after its duplicate window.
  await when('intake publishes the same "work.retry-requested@v1" again after the duplicate window', async () => {
    await run.events.publish("osf.work.retry-requested.v1", retryRequested(fakes, run.runId));
  });

  await then('the server warns that the run "<id>" already ran again as "<new id>"', async () => {
    const deadline = Date.now() + WAIT_MS;
    const warned = () =>
      sut.http
        .output()
        .stderr.split("\n")
        .filter((line) => line.startsWith("foreman: osf.work.retry-requested.v1: "));
    while (warned().length === 0 && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 50));
    // A warning is acknowledged: the message does not come again after 2 seconds.
    await new Promise((resolve) => setTimeout(resolve, 3000));
    expect(warned()).toEqual([`foreman: osf.work.retry-requested.v1: ${run.runId} already ran again as ${newId}`]);
  });

  await then('"/v1/runs" lists two runs', async () => {
    expect((await run.list()).data?.runs).toHaveLength(2);
  });
});

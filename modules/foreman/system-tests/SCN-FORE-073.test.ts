import { scenario } from "@opensoftware/testkit";
import { readmeWork, serving, WAIT_MS, workReceived } from "./foreman.ts";

scenario("SCN-FORE-073", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof serving>>;
  let events: Awaited<ReturnType<typeof sut.events.watch>>;
  await given(
    '"foreman serve" runs the README\'s "factory.yaml" with "FOREMAN_NATS_URL" set to a NATS server',
    async () => {
      server = await serving(sut, fakes, { nats: true });
      // Only the factory's subjects: a watcher of ">" would take the messages that NATS still sends to a stopped foreman.
      events = await sut.events.watch(server.nats as NonNullable<typeof server.nats>, "osf.>");
    },
  );

  await given("the foreman stops", async () => {
    await server.stop();
  });

  await when('intake publishes "work.received@v1" with the README\'s "work.json"', async () => {
    await events.publish("osf.work.received.v1", workReceived(fakes));
  });

  await when("the foreman starts again", async () => {
    await server.startAgain();
  });

  await then('"/v1/runs/<id>" of the work item\'s run shows the state "complete"', async () => {
    const [started] = await events.received("run.started@v1", { timeoutMs: WAIT_MS });
    const runId = (started?.data as { runId?: string } | undefined)?.runId as string;
    expect(started?.data).toMatchObject({ workItemId: readmeWork(fakes).id });
    expect((await server.until(runId, "complete")).workItem.id).toBe(readmeWork(fakes).id);
  });
});

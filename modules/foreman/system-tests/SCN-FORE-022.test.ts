import { scenario } from "@opensoftware/testkit";
import { readmeWork, serving } from "./foreman.ts";

scenario("SCN-FORE-022", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof serving>>;
  let events: Awaited<ReturnType<typeof sut.events.watch>>;
  await given(
    '"foreman serve" runs the README\'s "factory.yaml" with "FOREMAN_NATS_URL" set to a NATS server',
    async () => {
      server = await serving(sut, fakes, { nats: true });
      events = await sut.events.watch(server.nats as NonNullable<typeof server.nats>, "osf.>");
    },
  );

  await when('intake publishes "work.received@v1" with the README\'s "work.json"', async () => {
    const workItem = readmeWork(fakes);
    await events.publish("osf.work.received.v1", {
      specversion: "1.0",
      id: workItem.id,
      source: "/osf/intake",
      type: "work.received@v1",
      time: "2026-01-01T00:00:00Z",
      subject: workItem.id,
      data: workItem,
    });
  });

  let runId = "";
  await then(
    'the server publishes "run.started@v1" for the work item with the stages "plan" and "implement"',
    async () => {
      const [started] = await events.received("run.started@v1");
      expect(started).toMatchObject({
        source: "/osf/foreman",
        data: { workItemId: readmeWork(fakes).id, factory: "hello", stages: ["plan", "implement"] },
      });
      runId = (started?.data as { runId: string } | undefined)?.runId as string;
      expect(started?.id).toBe(`${runId}.started`);
    },
  );

  await then('"/v1/runs/<id>" of that run shows the state "complete"', async () => {
    const view = await server.until(runId, "complete");
    expect(view.workItem.id).toBe(readmeWork(fakes).id);
  });
});

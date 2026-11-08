import { connect } from "@nats-io/transport-node";
import { scenario } from "@opensoftware/testkit";
import { readmeWork, serving, WAIT_MS, workReceived } from "./foreman.ts";

scenario("SCN-FORE-083", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof serving>>;
  let events: Awaited<ReturnType<typeof sut.events.watch>>;
  await given(
    '"foreman serve" runs the README\'s "factory.yaml" with "FOREMAN_NATS_URL" set to a NATS server',
    async () => {
      server = await serving(sut, fakes, { nats: true });
      events = await sut.events.watch(server.nats as NonNullable<typeof server.nats>, "osf.>");
    },
  );

  await when('a program publishes the text "not json" on "osf.work.received.v1"', async () => {
    const nats = await connect({ servers: server.nats?.url });
    nats.publish("osf.work.received.v1", "not json");
    await nats.flush();
    await nats.close();
  });

  await when('intake publishes "work.received@v1" with the README\'s "work.json"', async () => {
    await events.publish("osf.work.received.v1", workReceived(fakes));
  });

  await then('the server publishes "run.started@v1" for the work item, once', async () => {
    const [started] = await events.received("run.started@v1", { timeoutMs: WAIT_MS });
    expect(started?.data).toMatchObject({ workItemId: readmeWork(fakes).id });
    // The text comes no second time and starts nothing.
    await new Promise((resolve) => setTimeout(resolve, 6000));
    expect(await events.received("run.started@v1")).toHaveLength(1);
  });
});

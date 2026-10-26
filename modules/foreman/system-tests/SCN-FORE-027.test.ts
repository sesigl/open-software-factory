import { scenario } from "@opensoftware/testkit";
import { PLAN, readmeWork, serving } from "./foreman.ts";

scenario("SCN-FORE-027", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof serving>>;
  let events: Awaited<ReturnType<typeof sut.events.watch>>;
  await given(
    '"foreman serve" runs the README\'s "factory.yaml" with "FOREMAN_NATS_URL" set to a NATS server',
    async () => {
      server = await serving(sut, fakes, { nats: true });
      events = await sut.events.watch(server.nats as NonNullable<typeof server.nats>);
    },
  );

  const received = (data: unknown, id: string) =>
    events.publish("osf.work.received.v1", {
      specversion: "1.0",
      id,
      source: "/osf/intake",
      type: "work.received@v1",
      time: "2026-01-01T00:00:00Z",
      subject: id,
      data,
    });
  const untitled = { ...readmeWork(fakes), id: "wi_00000000000000000001", title: undefined };

  await when('intake publishes "work.received@v1" with a work item without a title', async () => {
    await received(untitled, untitled.id);
  });

  await when('then "work.received@v1" with the README\'s "work.json"', async () => {
    await received(readmeWork(fakes), readmeWork(fakes).id);
  });

  await then("the run of the README's work item completes", async () => {
    while (server.prompts(PLAN).length === 0) await new Promise((resolve) => setTimeout(resolve, 20));
    // The run of a work item is one: posting it again answers the run the event started.
    const again = await server.start(readmeWork(fakes));
    expect(again.response.status).toBe(200);
    await server.until(again.data?.runId as string, "complete");
  });

  await then('the harness received the prompt "Write a plan" only once', async () => {
    expect(server.prompts(PLAN)).toHaveLength(1);
  });
});

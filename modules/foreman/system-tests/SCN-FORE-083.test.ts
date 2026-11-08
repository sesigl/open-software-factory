import { scenario } from "@opensoftware/testkit";
import { serving, workReceived } from "./foreman.ts";

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

  await when('intake publishes "work.received@v1" with a work item without a title', async () => {
    const event = workReceived(fakes);
    const { title: _title, ...untitled } = event.data;
    await events.publish("osf.work.received.v1", { ...event, data: untitled });
  });

  await when('gatekeeper publishes "gate.decided@v1" for a work item that has no run', async () => {
    await events.publish("osf.gate.decided.v1", {
      specversion: "1.0",
      id: "g0a1b2c3d4e5f6a7b.decided",
      source: "/osf/gatekeeper",
      type: "gate.decided@v1",
      time: "2026-01-01T00:00:00Z",
      subject: "g0a1b2c3d4e5f6a7b",
      data: {
        gateId: "g0a1b2c3d4e5f6a7b",
        workItemId: "wi_00000000000000000000",
        decision: "approved",
        decidedBy: { kind: "person", id: "slack:U0ADA" },
        decidedAt: "2026-01-01T00:00:00Z",
      },
    });
  });

  const warnings = (subject: string) =>
    sut.http
      .output()
      .stderr.split("\n")
      .filter((line) => line.includes(`${subject}:`));

  await then(
    'after 4 seconds the server warned once about "osf.work.received.v1", that the body is not a work item',
    async () => {
      // A message that comes again does so after 2 seconds.
      await new Promise((resolve) => setTimeout(resolve, 4000));
      const received = warnings("osf.work.received.v1");
      expect(received).toHaveLength(1);
      expect(received[0]).toMatch(/^foreman: osf\.work\.received\.v1: the body is not a work item: /);
    },
  );

  await then('it warned once about "osf.gate.decided.v1"', async () => {
    const decided = warnings("osf.gate.decided.v1");
    expect(decided).toHaveLength(1);
    expect(decided[0]).toMatch(/^foreman: osf\.gate\.decided\.v1: /);
  });
});

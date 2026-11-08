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

  await then(
    'after 7 seconds the server warned once about "osf.work.received.v1", that the body is not a work item',
    async () => {
      // A message that comes again does so after 5 seconds.
      await new Promise((resolve) => setTimeout(resolve, 7000));
      const warnings = sut.http
        .output()
        .stderr.split("\n")
        .filter((line) => line.includes("osf."));
      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toMatch(/^foreman: osf\.work\.received\.v1: the body is not a work item: /);
    },
  );
});

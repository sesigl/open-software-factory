import { scenario } from "@opensoftware/testkit";
import { readmeWork, serving } from "./foreman.ts";

scenario("SCN-FORE-023", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof serving>>;
  let events: Awaited<ReturnType<typeof sut.events.watch>>;
  await given(
    '"foreman serve" runs the committed README\'s "factory.yaml" with "FOREMAN_NATS_URL" set to a NATS server',
    async () => {
      server = await serving(sut, fakes, { nats: true });
      events = await sut.events.watch(server.nats as NonNullable<typeof server.nats>, "osf.run.>");
    },
  );

  await when('a program posts the README\'s "work.json" to "/v1/runs" with the API token', async () => {
    await server.start(readmeWork(fakes));
  });

  await then(
    'the server publishes "run.completed@v1" with the outcome "succeeded", the requester and that commit as the factory version',
    async () => {
      const [completed] = await events.received("run.completed@v1");
      expect(completed?.data).toMatchObject({
        workItemId: readmeWork(fakes).id,
        stage: "implement",
        outcome: "succeeded",
        factoryVersion: server.commit,
        requester: readmeWork(fakes).requester,
        source: "api",
        startedAt: "2026-01-01T00:00:00.000Z",
        endedAt: "2026-01-01T00:00:00.000Z",
      });
    },
  );
});

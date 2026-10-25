import { validate } from "@opensoftware/contracts";
import { scenario } from "@opensoftware/testkit";
import { readmeWork, serving } from "./server.ts";

scenario("SCN-INTAKE-010", async ({ sut, fakes, given, when, then }) => {
  const nats = await fakes.nats();
  let server: Awaited<ReturnType<typeof serving>>;
  await given('the server runs with "INTAKE_NATS_URL" set to a NATS server', async () => {
    server = await serving(sut, { INTAKE_NATS_URL: nats.url });
  });

  const events = await sut.events.watch(nats, "osf.work.>");
  let id = "";
  await when('a program posts the README\'s "work.json" to "/v1/work-items" with the API token', async () => {
    id = (await server.submit(readmeWork(fakes))).data?.workItem.id as string;
  });

  await then(
    'the event "work.received@v1" arrives on "osf.work.received.v1" with the work item\'s ID and title',
    async () => {
      const [event] = await events.received("work.received@v1", { count: 1 });
      expect(validate("work-received", event)).toEqual([]);
      expect(event).toMatchObject({
        id,
        source: "/osf/intake",
        subject: id,
        time: "2026-01-01T00:00:00.000Z",
        data: { id, title: "Export reports as CSV", dedupeKey: "idea:export-csv" },
      });
    },
  );
});

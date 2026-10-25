import { scenario } from "@opensoftware/testkit";
import { fromSlack, received } from "./server.ts";

scenario("SCN-INTAKE-011", async ({ sut, fakes, given, when, then }) => {
  const nats = await fakes.nats();
  const events = await sut.events.watch(nats, "osf.work.>");
  let server: Awaited<ReturnType<typeof received>>;
  await given(
    'the server, with "INTAKE_NATS_URL" set to a NATS server, received the README\'s "work.json"',
    async () => {
      server = await received(sut, fakes, { INTAKE_NATS_URL: nats.url });
    },
  );

  await when('a program posts a submission with the dedupe key "idea:export-csv" from the origin "slack"', async () => {
    expect((await server.submit(fromSlack(fakes))).response.status).toBe(200);
  });

  await then('the event "work.received@v1" arrives on "osf.work.received.v1" once', async () => {
    const arrived = await events.received("work.received@v1", { count: 1 });
    expect(arrived.map((event) => event.id)).toEqual([server.id]);
    // A second relay runs at most when the next request commits, which has happened; give its event time to land.
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(await events.received("work.received@v1", { count: 1 })).toHaveLength(1);
  });
});

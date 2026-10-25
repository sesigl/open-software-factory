import { scenario } from "@opensoftware/testkit";
import { received } from "./server.ts";

scenario("SCN-INTAKE-012", async ({ sut, fakes, given, when, then }) => {
  const nats = await fakes.nats();
  let server: Awaited<ReturnType<typeof received>>;
  await given(
    'the server, with "INTAKE_NATS_URL" set to a port where no NATS listens, received the README\'s "work.json"',
    async () => {
      server = await received(sut, fakes, { INTAKE_NATS_URL: "nats://127.0.0.1:1" });
    },
  );

  const events = await sut.events.watch(nats, "osf.work.>");
  await when('the server starts again with "INTAKE_NATS_URL" set to a NATS server', async () => {
    await server.restart({ INTAKE_NATS_URL: nats.url });
  });

  await then('the event "work.received@v1" arrives on "osf.work.received.v1" once', async () => {
    const arrived = await events.received("work.received@v1", { count: 1 });
    expect(arrived.map((event) => event.id)).toEqual([server.id]);
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(await events.received("work.received@v1", { count: 1 })).toHaveLength(1);
  });
});

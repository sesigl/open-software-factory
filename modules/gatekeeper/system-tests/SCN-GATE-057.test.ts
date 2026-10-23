import { scenario } from "@opensoftware/testkit";
import { askedServer } from "./server.ts";

scenario("SCN-GATE-057", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof askedServer>>;
  const nats = await fakes.nats();
  await given(
    'the server, with "GATEKEEPER_NATS_URL" set to a port where no NATS listens, asked "maintainers" for approval of the README request',
    async () => {
      server = await askedServer(sut, fakes, { env: { GATEKEEPER_NATS_URL: "nats://127.0.0.1:1" } });
    },
  );

  const events = await sut.events.watch(nats, "osf.gate.>");
  await when('the server starts again with "GATEKEEPER_NATS_URL" set to a NATS server', async () => {
    await server.restart({ GATEKEEPER_NATS_URL: nats.url });
  });

  await then('the event "gate.requested@v1" arrives on "osf.gate.requested.v1" once', async () => {
    const received = await events.received("gate.requested@v1", { count: 1 });
    expect(received.map((event) => event.id)).toEqual([`${server.id}.requested`]);
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(await events.received("gate.requested@v1", { count: 1 })).toHaveLength(1);
  });
});

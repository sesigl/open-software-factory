import { scenario } from "@opensoftware/testkit";
import { askedServer } from "./server.ts";

scenario("SCN-GATE-056", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof askedServer>>;
  const nats = await fakes.nats();
  await given(
    'the server, with "GATEKEEPER_NATS_URL" set to a NATS server, asked "maintainers" for approval of the README request',
    async () => {
      server = await askedServer(sut, fakes, { env: { GATEKEEPER_NATS_URL: nats.url } });
    },
  );

  const events = await sut.events.watch(nats, "osf.gate.>");
  await when('"slack:U0ADA" of "maintainers" presses "Approve" on the request', async () => {
    await server.slack.press({
      channel: "C0GATES",
      ts: server.message.ts,
      actionId: "Approve",
      user: "U0ADA",
    });
  });

  await then(
    'the event "gate.decided@v1" arrives on "osf.gate.decided.v1" with the decision "approved" by "slack:U0ADA"',
    async () => {
      const [event] = await events.received("gate.decided@v1");
      expect(event).toMatchObject({ id: `${server.id}.decided`, subject: server.id });
      expect(event?.data).toMatchObject({
        gateId: server.id,
        decision: "approved",
        decidedBy: { kind: "person", id: "slack:U0ADA" },
        decidedAt: "2026-01-01T00:00:00.000001Z",
      });
    },
  );
});

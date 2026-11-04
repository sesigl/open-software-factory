import { scenario } from "@opensoftware/testkit";
import { PR, statuses } from "./gate.ts";
import { askedOnPullRequest } from "./server.ts";

scenario("SCN-GATE-064", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof askedOnPullRequest>>;
  const nats = await fakes.nats();
  await given(
    'the server, with "GATEKEEPER_NATS_URL" set to a NATS server, asked "maintainers" on the pull request "acme/web#12"',
    async () => {
      server = await askedOnPullRequest(sut, fakes, { GATEKEEPER_NATS_URL: nats.url });
    },
  );

  const events = await sut.events.watch(nats, "osf.gate.>");
  await when('"github:sesigl" of "maintainers" comments "/approve" on the pull request', async () => {
    server.http.comment({ id: 901, body: "/approve", login: "sesigl", at: "2026-01-01T00:10:00Z" });
  });

  await then(
    '"/v1/gates/<gate>" shows the state "approved" and a record approved by the person "github:sesigl"',
    async () => {
      const gate = await server.decided(server.id);
      expect(gate).toMatchObject({ id: server.id, state: "approved", channel: PR });
      expect(gate?.record).toMatchObject({
        gate: server.id,
        channel: PR,
        decision: "approved",
        decidedBy: { kind: "person", id: "github:sesigl" },
        decidedAt: "2026-01-01T00:10:00.000000Z",
      });
    },
  );

  await then(
    'the event "gate.decided@v1" arrives on "osf.gate.decided.v1" with the decision "approved" by "github:sesigl"',
    async () => {
      const [event] = await events.received("gate.decided@v1");
      expect(event).toMatchObject({ id: `${server.id}.decided`, subject: server.id });
      expect(event?.data).toMatchObject({
        gateId: server.id,
        decision: "approved",
        decidedBy: { kind: "person", id: "github:sesigl" },
      });
    },
  );

  await then(
    'the head commit of the pull request has the commit status "gatekeeper" with the state "success" and the description "approved by github:sesigl"',
    async () => {
      expect(statuses(server.http).map(({ state, description }) => ({ state, description }))).toEqual([
        { state: "pending", description: "waiting for maintainers" },
        { state: "success", description: "approved by github:sesigl" },
      ]);
    },
  );
});

import { scenario } from "@opensoftware/testkit";
import { serving } from "./foreman.ts";

scenario("SCN-FORE-084", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof serving>>;
  let events: Awaited<ReturnType<typeof sut.events.watch>>;
  await given(
    '"foreman serve" runs the README\'s "factory.yaml" with "FOREMAN_NATS_URL" set to a NATS server',
    async () => {
      server = await serving(sut, fakes, { nats: true });
      events = await sut.events.watch(server.nats as NonNullable<typeof server.nats>, "osf.>");
    },
  );

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

  await then('after 7 seconds the server warned once about "osf.gate.decided.v1"', async () => {
    // A message that comes again does so after 5 seconds.
    await new Promise((resolve) => setTimeout(resolve, 7000));
    const warnings = sut.http
      .output()
      .stderr.split("\n")
      .filter((line) => line.includes("osf."));
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/^foreman: osf\.gate\.decided\.v1: /);
  });
});

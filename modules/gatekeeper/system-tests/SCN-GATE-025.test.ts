import { scenario } from "@opensoftware/testkit";
import { GATE, requested } from "./gate.ts";

scenario("SCN-GATE-025", async ({ sut, fakes, given, when, then }) => {
  let setup: Awaited<ReturnType<typeof requested>>;
  const nats = await fakes.nats();
  await given('the approval request of the README request in the Slack channel "C0GATES"', async () => {
    setup = await requested(sut, fakes);
  });

  await given('"slack:U0ADA" of "maintainers" replied "approve" in its thread', async () => {
    await setup.slack.say({ channel: "C0GATES", text: "approve", user: "U0ADA", threadTs: setup.message.ts });
  });

  await given('"GATEKEEPER_NATS_URL" set to a NATS server', async () => {});

  const events = await sut.events.watch(nats, "osf.gate.>");
  await when('the user runs "gatekeeper status" with the same arguments', async () => {
    const run = await sut.cli(["status", ...GATE], { env: { ...setup.env, GATEKEEPER_NATS_URL: nats.url } });
    expect(run.exitCode, run.stderr).toBe(0);
  });

  let event: Awaited<ReturnType<typeof events.received>>[number] | undefined;
  await then('the event "gate.decided@v1" arrives on "osf.gate.decided.v1"', async () => {
    [event] = await events.received("gate.decided@v1");
    expect(event).toMatchObject({ source: "/osf/gatekeeper", subject: expect.stringMatching(/^g[0-9a-f]{16}$/) });
  });

  await then('the event has the decision "approved" by the person "slack:U0ADA"', async () => {
    expect(event?.data).toMatchObject({
      decision: "approved",
      decidedBy: { kind: "person", id: "slack:U0ADA" },
      decidedAt: "2026-01-01T00:00:00.000002Z",
      workItemId: "https://github.com/acme/web/pull/6",
    });
  });
});

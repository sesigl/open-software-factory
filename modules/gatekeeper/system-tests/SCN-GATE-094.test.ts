import { scenario } from "@opensoftware/testkit";
import { GATE, putReadme, slackEnv } from "./gate.ts";

const WEEK_MS = 7 * 86_400_000;

scenario("SCN-GATE-094", async ({ sut, fakes, given, when, then }) => {
  const { env } = await slackEnv(sut, fakes);
  const nats = await fakes.nats();
  await given("the README policy, groups and request", async () => {
    await putReadme(sut, fakes);
  });

  await given(
    '"GATEKEEPER_NATS_URL" set to a NATS server whose stream "OSF" keeps an event at most 7 days',
    async () => {
      await sut.events.stream(nats, "OSF", { subjects: ["osf.>"], maxAgeMs: WEEK_MS });
    },
  );

  const events = await sut.events.watch(nats, "osf.gate.>");
  await when('the user runs "gatekeeper request" for the channel "slack:C0GATES"', async () => {
    const run = await sut.cli(["request", ...GATE], { env: { ...env, GATEKEEPER_NATS_URL: nats.url } });
    expect(run.exitCode, run.stderr).toBe(0);
  });

  await then('the event "gate.requested@v1" arrives on "osf.gate.requested.v1"', async () => {
    const [event] = await events.received("gate.requested@v1");
    expect(event).toMatchObject({ source: "/osf/gatekeeper", type: "gate.requested@v1" });
  });

  await then('the stream "OSF" keeps an event at most 7 days', async () => {
    expect(await sut.events.stream(nats, "OSF")).toEqual({ subjects: ["osf.>"], maxAgeMs: WEEK_MS, messages: 1 });
  });
});

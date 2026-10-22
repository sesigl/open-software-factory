import { scenario } from "@opensoftware/testkit";
import { GATE, putReadme, slackEnv } from "./gate.ts";

scenario("SCN-GATE-012", async ({ sut, fakes, given, when, then }) => {
  const { env } = await slackEnv(fakes);
  const nats = await fakes.nats();
  await given("the README policy, groups and request", async () => {
    await putReadme(sut, fakes);
  });

  await given('"GATEKEEPER_NATS_URL" set to a NATS server', async () => {});

  const events = await sut.events.watch(nats, "osf.gate.>");
  await when('the user runs "gatekeeper request" for the channel "slack:C0GATES"', async () => {
    const run = await sut.cli(["request", ...GATE], { env: { ...env, GATEKEEPER_NATS_URL: nats.url } });
    expect(run.exitCode, run.stderr).toBe(0);
  });

  let event: Awaited<ReturnType<typeof events.received>>[number] | undefined;
  await then('the event "gate.requested@v1" arrives on "osf.gate.requested.v1"', async () => {
    [event] = await events.received("gate.requested@v1");
    expect(event).toMatchObject({ source: "/osf/gatekeeper", specversion: "1.0" });
  });

  await then(
    'the event names the stage "merge", the approver group "maintainers" and the policy "policy.rego"',
    async () => {
      expect(event?.data).toMatchObject({
        stage: "merge",
        approvers: ["maintainers"],
        policy: "policy.rego",
        workItemId: "https://github.com/acme/web/pull/6",
        expiresAt: "2026-01-03T00:00:00.000001Z",
      });
    },
  );
});

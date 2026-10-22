import { scenario } from "@opensoftware/testkit";
import { GATE, requested } from "./gate.ts";

scenario("SCN-GATE-014", async ({ sut, fakes, given, when, then }) => {
  let setup: Awaited<ReturnType<typeof requested>>;
  await given('the approval request of the README request in the Slack channel "C0GATES"', async () => {
    setup = await requested(sut, fakes);
  });

  await given(
    '"slack:U0ADA" of "maintainers" replied "approve" in its thread with the Slack time "1767225600.000002"',
    async () => {
      const reply = await setup.slack.say({
        channel: "C0GATES",
        text: "approve",
        user: "U0ADA",
        threadTs: setup.message.ts,
      });
      expect(reply.ts).toBe("1767225600.000002");
    },
  );

  await when('the user runs "gatekeeper status" with the same arguments', async () => {
    await sut.cli(["status", ...GATE], { env: setup.env });
  });

  let record: Record<string, unknown> = {};
  await then(
    '"$OUTPUT/record.json" has the decision "approved" by the person "slack:U0ADA" at "2026-01-01T00:00:00.000002Z"',
    async () => {
      record = JSON.parse(await sut.files.read("$OUTPUT/record.json"));
      expect(record).toMatchObject({
        decision: "approved",
        decidedBy: { kind: "person", id: "slack:U0ADA" },
        decidedAt: "2026-01-01T00:00:00.000002Z",
        requestedAt: "2026-01-01T00:00:00.000001Z",
      });
    },
  );

  await then(
    'the record names the gate, the work item "https://github.com/acme/web/pull/6", the stage "merge" and the approver group "maintainers"',
    async () => {
      expect(record).toMatchObject({
        gate: expect.stringMatching(/^g[0-9a-f]{16}$/),
        workItem: "https://github.com/acme/web/pull/6",
        stage: "merge",
        approvers: ["maintainers"],
        risk: "high",
        channel: "slack:C0GATES",
        policy: "policy.rego",
        request: expect.stringMatching(/^sha256:[0-9a-f]{64}$/),
        policyDigest: expect.stringMatching(/^sha256:[0-9a-f]{64}$/),
      });
    },
  );
});

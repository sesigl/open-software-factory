import { scenario } from "@opensoftware/testkit";
import { GATE, replies, requested } from "./gate.ts";

scenario("SCN-GATE-015", async ({ sut, fakes, given, when, then }) => {
  let setup: Awaited<ReturnType<typeof requested>>;
  await given('the approval request of the README request in the Slack channel "C0GATES"', async () => {
    setup = await requested(sut, fakes);
  });

  await given('"slack:U0ADA" of "maintainers" replied "reject Needs a migration plan" in its thread', async () => {
    await setup.slack.say({
      channel: "C0GATES",
      text: "reject Needs a migration plan",
      user: "U0ADA",
      threadTs: setup.message.ts,
    });
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "gatekeeper status" with the same arguments', async () => {
    run = await sut.cli(["status", ...GATE], { env: setup.env });
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stderr).toBe(1);
    expect(run.stdout).toMatch(/rejected by slack:U0ADA: Needs a migration plan$/m);
    expect(replies(setup.slack, setup.message)[1]).toMatch(/^Rejected by <@U0ADA>: Needs a migration plan\./);
  });

  await then('"$OUTPUT/record.json" has the decision "rejected" with the reason "Needs a migration plan"', async () => {
    expect(JSON.parse(await sut.files.read("$OUTPUT/record.json"))).toMatchObject({
      decision: "rejected",
      decidedBy: { kind: "person", id: "slack:U0ADA" },
      reason: "Needs a migration plan",
    });
  });
});

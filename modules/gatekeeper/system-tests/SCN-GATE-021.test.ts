import { scenario } from "@opensoftware/testkit";
import { GATE, replies, requested } from "./gate.ts";

scenario("SCN-GATE-021", async ({ sut, fakes, given, when, then }) => {
  let setup: Awaited<ReturnType<typeof requested>>;
  await given('the approval request of the README request in the Slack channel "C0GATES"', async () => {
    setup = await requested(sut, fakes);
  });

  await given('"slack:U0LEO" of "leads" replied "approve" in its thread', async () => {
    await setup.slack.say({ channel: "C0GATES", text: "approve", user: "U0LEO", threadTs: setup.message.ts });
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "gatekeeper status" with the same arguments', async () => {
    run = await sut.cli(["status", ...GATE], { env: setup.env });
  });

  await then("the command exits with code 3", async () => {
    expect(run.exitCode, run.stderr).toBe(3);
  });

  await then('the thread has the reply "<@U0LEO> is not in maintainers"', async () => {
    expect(replies(setup.slack, setup.message)[1]).toMatch(
      /^<@U0LEO> is not in maintainers, so this decision does not count\./,
    );
  });
});

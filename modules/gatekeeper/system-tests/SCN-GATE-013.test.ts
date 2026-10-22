import { scenario } from "@opensoftware/testkit";
import { GATE, replies, requested } from "./gate.ts";

scenario("SCN-GATE-013", async ({ sut, fakes, given, when, then }) => {
  let setup: Awaited<ReturnType<typeof requested>>;
  await given('the approval request of the README request in the Slack channel "C0GATES"', async () => {
    setup = await requested(sut, fakes);
  });

  await given('"slack:U0ADA" of "maintainers" replied "approve" in its thread', async () => {
    await setup.slack.say({ channel: "C0GATES", text: "approve", user: "U0ADA", threadTs: setup.message.ts });
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "gatekeeper status" with the same arguments', async () => {
    run = await sut.cli(["status", ...GATE], { env: setup.env });
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stderr).toBe(0);
  });

  await then('the output says "approved by slack:U0ADA"', async () => {
    expect(run.stdout).toMatch(/^gate g[0-9a-f]{16} approved by slack:U0ADA$/m);
  });

  await then('the thread has the reply "Approved by <@U0ADA>"', async () => {
    expect(replies(setup.slack, setup.message)).toEqual([
      "approve",
      expect.stringMatching(/^Approved by <@U0ADA>\.\n\[gatekeeper g[0-9a-f]{16} decided\]$/),
    ]);
  });
});

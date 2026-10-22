import { scenario } from "@opensoftware/testkit";
import { GATE, replies, requested } from "./gate.ts";

scenario("SCN-GATE-017", async ({ sut, fakes, given, when, then }) => {
  let setup: Awaited<ReturnType<typeof requested>>;
  await given('the approval request of the README request in the Slack channel "C0GATES"', async () => {
    setup = await requested(sut, fakes);
  });

  await given('"slack:U0EVE", who is in no group, replied "approve" in its thread', async () => {
    await setup.slack.say({ channel: "C0GATES", text: "approve", user: "U0EVE", threadTs: setup.message.ts });
  });

  await when('the user runs "gatekeeper status" with the same arguments twice', async () => {
    for (const _ of [1, 2]) expect((await sut.cli(["status", ...GATE], { env: setup.env })).exitCode).toBe(3);
  });

  await then('the thread has one reply that says "<@U0EVE> is not in maintainers"', async () => {
    const refusals = replies(setup.slack, setup.message).filter((text) =>
      text.includes("<@U0EVE> is not in maintainers"),
    );
    expect(refusals).toHaveLength(1);
  });
});

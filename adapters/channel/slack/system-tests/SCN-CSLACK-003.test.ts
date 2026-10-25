import { scenario } from "@opensoftware/testkit";
import { CHANNEL, setup } from "./channel.ts";

scenario("SCN-CSLACK-003", async ({ sut, fakes, when, then }) => {
  let box: Awaited<ReturnType<typeof setup>>;
  let printed: Record<string, unknown>;
  await when('the client runs "ask slack:C0WEB" with "Deploy 42 to production?"', async () => {
    box = await setup(sut, fakes);
    printed = await box.json(["ask", `slack:${CHANNEL}`, "Deploy 42 to production?"]);
  });

  await then(
    'the test chat shows the bot\'s card with "Deploy 42 to production?" and the choices "approve" and "reject" at the top of the channel "C0WEB"',
    async () => {
      const [card, ...more] = box.slack.messages(CHANNEL);
      expect(more).toEqual([]);
      expect(card).toMatchObject({ user: box.slack.bot, threadTs: card?.ts });
      expect(card?.text).toContain("Deploy 42 to production?");
      expect(card?.buttons).toEqual([
        { actionId: "approve", text: "approve", value: "approve" },
        { actionId: "reject", text: "reject", value: "reject" },
      ]);
    },
  );

  await then("ask prints the thread of that card and its ID", async () => {
    const ts = box.slack.messages(CHANNEL)[0]?.ts;
    expect(printed).toEqual({ thread: `slack:${CHANNEL}:${ts}`, id: ts });
  });
});

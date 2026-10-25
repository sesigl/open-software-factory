import { scenario } from "@opensoftware/testkit";
import { CHANNEL, setup } from "./channel.ts";

scenario("SCN-CSLACK-002", async ({ sut, fakes, when, then }) => {
  let box: Awaited<ReturnType<typeof setup>>;
  let printed: Record<string, unknown>;
  await when('the client runs "reply slack:C0WEB" with "Deploy 42 waits for approval"', async () => {
    box = await setup(sut, fakes);
    printed = await box.json(["reply", `slack:${CHANNEL}`, "Deploy 42 waits for approval"]);
  });

  await then(
    'the test chat shows the bot\'s message "Deploy 42 waits for approval" at the top of the channel "C0WEB"',
    async () => {
      // A message at the top of a channel is the first message of its own thread.
      const messages = box.slack.messages(CHANNEL);
      expect(messages.map(({ user, text, threadTs }) => ({ user, text, threadTs }))).toEqual([
        { user: box.slack.bot, text: "Deploy 42 waits for approval", threadTs: messages[0]?.ts },
      ]);
    },
  );

  await then("reply prints the thread of that message and its ID", async () => {
    const ts = box.slack.messages(CHANNEL)[0]?.ts;
    expect(printed).toEqual({ thread: `slack:${CHANNEL}:${ts}`, id: ts });
  });
});

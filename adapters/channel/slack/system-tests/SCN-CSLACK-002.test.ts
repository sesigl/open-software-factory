import { scenario } from "@opensoftware/testkit";
import { CHANNEL, setup } from "./channel.ts";

scenario("SCN-CSLACK-002", async ({ sut, fakes, when, then }) => {
  let box: Awaited<ReturnType<typeof setup>>;
  let printed: Record<string, unknown>;
  await when('the client runs "reply" on "slack:C0WEB" with "Approval needed from maintainers"', async () => {
    box = await setup(sut, fakes);
    printed = await box.json(["reply", `slack:${CHANNEL}`, "Approval needed from maintainers"]);
  });

  await then(
    'the test chat shows the bot\'s message "Approval needed from maintainers" that starts a thread in "C0WEB"',
    async () => {
      const messages = box.slack.messages(CHANNEL);
      expect(messages.map(({ user, text, ts, threadTs }) => ({ user, text, starts: ts === threadTs }))).toEqual([
        { user: box.slack.bot, text: "Approval needed from maintainers", starts: true },
      ]);
    },
  );

  await then('reply prints that thread as "slack:C0WEB:<ts>", the message\'s ID and its time', async () => {
    const ts = box.slack.messages(CHANNEL)[0]?.ts;
    expect(printed).toEqual({
      thread: `slack:${CHANNEL}:${ts}`,
      id: ts,
      time: expect.stringMatching(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{6}Z$/),
    });
  });
});

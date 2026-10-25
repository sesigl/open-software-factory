import { scenario } from "@opensoftware/testkit";
import { CHANNEL, setup } from "./channel.ts";

const QUESTION = "Approval needed from maintainers (risk high)";

scenario("SCN-CSLACK-004", async ({ sut, fakes, when, then }) => {
  let box: Awaited<ReturnType<typeof setup>>;
  await when(
    `the client runs "ask" on "slack:C0WEB" with "${QUESTION}" and the choices "Approve" and "Reject"`,
    async () => {
      box = await setup(sut, fakes);
      await box.json(["ask", `slack:${CHANNEL}`, QUESTION, "--choice", "Approve", "--choice", "Reject"]);
    },
  );

  await then(`the test chat shows the bot's message with the text "${QUESTION}"`, async () => {
    expect(box.slack.messages(CHANNEL).map(({ user, text }) => ({ user, text }))).toEqual([
      { user: box.slack.bot, text: QUESTION },
    ]);
  });

  await then('the message has the buttons "Approve" and "Reject"', async () => {
    expect(box.slack.messages(CHANNEL)[0]?.buttons.map((button) => button.text)).toEqual(["Approve", "Reject"]);
  });
});

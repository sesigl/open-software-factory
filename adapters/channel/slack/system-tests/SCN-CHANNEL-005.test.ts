import { scenario } from "@opensoftware/testkit";
import { CHANNEL, setup, thread } from "./channel.ts";

scenario("SCN-CHANNEL-005", async ({ sut, fakes, given, when, then }) => {
  let box: Awaited<ReturnType<typeof setup>>;
  let id = "";
  await given("a work item that receive printed for the person's message", async () => {
    box = await setup(sut, fakes);
    id = await thread(box);
  });

  let printed: Record<string, unknown>;
  await when('the client runs "reply" on its thread with "On it: run 7 started"', async () => {
    printed = await box.json(["reply", id, "On it: run 7 started"]);
  });

  await then('the test chat shows the bot\'s message "On it: run 7 started" in that thread', async () => {
    const [first, ...replies] = box.slack.messages(CHANNEL);
    expect(id).toBe(`slack:${CHANNEL}:${first?.ts}`);
    expect(replies.map(({ user, text, threadTs }) => ({ user, text, threadTs }))).toEqual([
      { user: box.slack.bot, text: "On it: run 7 started", threadTs: first?.ts },
    ]);
  });

  await then("reply prints the thread and the message's ID", async () => {
    expect(printed).toEqual({ thread: id, time: expect.stringMatching(/Z$/), id: box.slack.messages(CHANNEL)[1]?.ts });
  });
});

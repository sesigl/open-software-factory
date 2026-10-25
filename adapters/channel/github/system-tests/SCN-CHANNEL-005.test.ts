import { scenario } from "@opensoftware/testkit";
import { PERSON, setup, thread } from "./channel.ts";

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
    expect(id).toBe(box.thread);
    const comments = await box.github.conversation(box.pr);
    expect(comments.map(({ user, body }) => ({ user, body }))).toEqual([
      { user: PERSON, body: "@tester Fix the checkout button on Safari" },
      { user: box.github.owner, body: "On it: run 7 started" },
    ]);
  });

  await then("reply prints the thread and the message's ID", async () => {
    const [, posted] = await box.github.conversation(box.pr);
    expect(printed).toEqual({ thread: id, time: expect.stringMatching(/Z$/), id: String(posted?.id) });
  });
});

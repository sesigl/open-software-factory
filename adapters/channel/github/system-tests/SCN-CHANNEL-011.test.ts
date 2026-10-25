import { scenario } from "@opensoftware/testkit";
import { PERSON, setup, thread } from "./channel.ts";

scenario("SCN-CHANNEL-011", async ({ sut, fakes, given, when, then }) => {
  let box: Awaited<ReturnType<typeof setup>>;
  let id = "";
  await given("a work item that receive printed for the person's message", async () => {
    box = await setup(sut, fakes);
    id = await thread(box);
  });

  let file = "";
  let comment = 0;
  await given('a delivery of the person\'s message "approve" in its thread', async () => {
    const said = await box.github.say(box.pr, "approve");
    comment = said.id;
    file = await box.delivery(said);
  });

  let printed: Record<string, unknown>;
  await when('the client runs "receive" on it with "--thread" naming that thread', async () => {
    printed = await box.json(["receive", file, "--thread", id]);
  });

  await then('receive prints the message "approve" in that thread by the person with its ID and time', async () => {
    expect(printed).toEqual({
      kind: "message",
      thread: id,
      id: String(comment),
      person: `github:${PERSON}`,
      time: expect.stringMatching(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/),
      text: "approve",
    });
  });
});

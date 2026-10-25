import { scenario } from "@opensoftware/testkit";
import { CHANNEL, PERSON, setup, thread } from "./channel.ts";

scenario("SCN-CHANNEL-007", async ({ sut, fakes, given, when, then }) => {
  let box: Awaited<ReturnType<typeof setup>>;
  let id = "";
  let card = "";
  await given('the client ran "ask" on a thread with "Merge pull request 12 into main?"', async () => {
    box = await setup(sut, fakes);
    id = await thread(box);
    card = String((await box.json(["ask", id, "Merge pull request 12 into main?"])).id);
  });

  let file = "";
  await given('a delivery of the person choosing "approve" on that card', async () => {
    await box.slack.press({ channel: CHANNEL, ts: card, actionId: "approve" });
    file = await box.delivery();
  });

  let printed: Record<string, unknown>;
  await when('the client runs "receive" on it', async () => {
    printed = await box.json(["receive", file]);
  });

  await then('receive prints the decision "approve" on that card in that thread by the person', async () => {
    expect(printed).toEqual({ kind: "decision", thread: id, card, choice: "approve", time: expect.stringMatching(/Z$/), person: `slack:${PERSON}` });
  });
});

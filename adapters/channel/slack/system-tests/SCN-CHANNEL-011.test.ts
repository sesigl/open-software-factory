import { scenario } from "@opensoftware/testkit";
import { CHANNEL, PERSON, setup, thread } from "./channel.ts";

scenario("SCN-CHANNEL-011", async ({ sut, fakes, given, when, then }) => {
  let box: Awaited<ReturnType<typeof setup>>;
  let id = "";
  await given("a work item that receive printed for the person's message", async () => {
    box = await setup(sut, fakes);
    id = await thread(box);
  });

  let file = "";
  let ts = "";
  await given('a delivery of the person\'s message "approve" in its thread', async () => {
    const threadTs = box.slack.messages(CHANNEL)[0]?.ts;
    ts = (await box.slack.say({ channel: CHANNEL, text: "approve", user: PERSON, threadTs })).ts;
    file = await box.delivery();
  });

  let printed: Record<string, unknown>;
  await when('the client runs "receive" on it with "--thread" naming that thread', async () => {
    printed = await box.json(["receive", file, "--thread", id]);
  });

  await then('receive prints the message "approve" in that thread by the person with its ID and time', async () => {
    const [seconds, micros] = ts.split(".");
    const time = `${new Date(Number(seconds) * 1000).toISOString().slice(0, 19)}.${micros}Z`;
    expect(printed).toEqual({ kind: "message", thread: id, id: ts, person: `slack:${PERSON}`, time, text: "approve" });
  });
});

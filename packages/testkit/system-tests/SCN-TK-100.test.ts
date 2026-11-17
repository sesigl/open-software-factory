import { type FakeSlack, scenario } from "@opensoftware/testkit";
import { slackCall } from "./slack.ts";

scenario("SCN-TK-100", async ({ fakes, given, when, then }) => {
  let slack: FakeSlack;
  await given("fakes.slack", async () => {
    slack = await fakes.slack();
  });

  let texts = "";
  await when(
    'a module posts "first" and "second" to "C1", replies "in thread" to "first" and reads the texts of "conversations.history"',
    async () => {
      const first = await slackCall(slack, "chat.postMessage", { channel: "C1", text: "first" });
      await slackCall(slack, "chat.postMessage", { channel: "C1", text: "second" });
      await slackCall(slack, "chat.postMessage", { channel: "C1", text: "in thread", thread_ts: first.ts });
      const { messages } = await slackCall(slack, "conversations.history", { channel: "C1" });
      texts = messages.map((message: { text: string }) => message.text).join(" ");
    },
  );

  await then('the texts are "second first"', async () => {
    expect(texts).toBe("second first");
  });
});

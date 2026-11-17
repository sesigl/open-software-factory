import { type FakeSlack, scenario } from "@opensoftware/testkit";
import { slackCall } from "./slack.ts";

scenario("SCN-TK-051", async ({ fakes, given, when, then }) => {
  let slack: FakeSlack;
  await given("fakes.slack", async () => {
    slack = await fakes.slack();
  });

  let users = "";
  await when(
    'a module gets the "user_id" of "auth.test", posts a message to "C1" and reads the user of that message from "conversations.history"',
    async () => {
      const { user_id } = await slackCall(slack, "auth.test", {});
      await slackCall(slack, "chat.postMessage", { channel: "C1", text: "hello" });
      const { messages } = await slackCall(slack, "conversations.history", { channel: "C1" });
      users = `${user_id} ${messages[0].user}`;
    },
  );

  await then("both name the bot user of fakes.slack", async () => {
    expect(users).toBe(`${slack.bot} ${slack.bot}`);
  });
});

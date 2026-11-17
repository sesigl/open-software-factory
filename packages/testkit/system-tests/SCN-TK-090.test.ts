import { type FakeSlack, scenario } from "@opensoftware/testkit";
import { slackCall } from "./slack.ts";

scenario("SCN-TK-090", async ({ fakes, given, when, then }) => {
  let slack: FakeSlack;
  await given("fakes.slack", async () => {
    slack = await fakes.slack();
  });

  let answer = "";
  await when(
    'a module gets the "real_name" of "users.info" for "U0PERSON" and the "permalink" of the message it posts to "C1"',
    async () => {
      const { user } = await slackCall(slack, "users.info", { user: "U0PERSON" });
      const { ts } = await slackCall(slack, "chat.postMessage", { channel: "C1", text: "hello" });
      const { permalink } = await slackCall(slack, "chat.getPermalink", { channel: "C1", message_ts: ts });
      answer = `${user.real_name} ${permalink}`;
    },
  );

  await then('they are "Varun https://testkit.slack.com/archives/C1/p1767225600000001"', async () => {
    expect(answer).toBe("Varun https://testkit.slack.com/archives/C1/p1767225600000001");
  });
});

import { type FakeSlack, scenario } from "@opensoftware/testkit";
import { slackCall } from "./slack.ts";

scenario("SCN-TK-013", async ({ fakes, given, when, then }) => {
  let slack: FakeSlack;
  await given("fakes.slack", async () => {
    slack = await fakes.slack();
  });

  await when(
    'a module posts "hello from demo" to the channel "C1" through the Slack Web API of the fake with its token',
    async () => {
      await slackCall(slack, "chat.postMessage", { channel: "C1", text: "hello from demo" });
    },
  );

  await then('"C1" has the message "hello from demo"', async () => {
    expect(slack.messages("C1").map((message) => message.text)).toContain("hello from demo");
  });
});

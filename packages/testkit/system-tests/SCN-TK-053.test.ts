import { type FakeHttp, type FakeSlack, scenario } from "@opensoftware/testkit";
import { signedBodies, slackCall } from "./slack.ts";

scenario("SCN-TK-053", async ({ fakes, given, when, then }) => {
  let slack: FakeSlack;
  let receiver: FakeHttp;
  let ts = "";
  await given(
    'a message with the button "approve" that a module posted to "C1", and fakes.slack that delivers presses to a URL of fakes.http',
    async () => {
      slack = await fakes.slack();
      receiver = await fakes.http([{ method: "POST", path: "/actions", body: {} }]);
      slack.deliverTo(`${receiver.url}/events`, `${receiver.url}/actions`);
      const button = { type: "button", action_id: "approve", text: { type: "plain_text", text: "Approve" } };
      const blocks = [{ type: "actions", elements: [button] }];
      ({ ts } = await slackCall(slack, "chat.postMessage", { channel: "C1", text: "Approve?", blocks }));
    },
  );

  await when('"U0ADA" presses "approve" in "C1"', async () => {
    await slack.press({ channel: "C1", ts, actionId: "approve", user: "U0ADA" });
  });

  await then(
    'the URL got one press of "approve" by "U0ADA", signed with the signing secret of fakes.slack',
    async () => {
      const bodies = await signedBodies(receiver, "/actions", slack.signingSecret);
      expect(bodies.map(({ signed }) => signed)).toEqual([true]);
      const payload = JSON.parse(new URLSearchParams(bodies[0]?.text).get("payload") ?? "{}");
      expect(`${payload.actions?.[0]?.action_id} ${payload.user?.id}`).toBe("approve U0ADA");
    },
  );
});

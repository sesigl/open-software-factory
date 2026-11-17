import { type FakeHttp, type FakeSlack, scenario } from "@opensoftware/testkit";
import { signedBodies } from "./slack.ts";

scenario("SCN-TK-052", async ({ fakes, given, when, then }) => {
  let slack: FakeSlack;
  let receiver: FakeHttp;
  await given("fakes.slack that delivers events to a URL of fakes.http", async () => {
    slack = await fakes.slack();
    receiver = await fakes.http([{ method: "POST", path: "/events", body: {} }]);
    slack.deliverTo(`${receiver.url}/events`);
  });

  await when('a person says "approve" in "C1"', async () => {
    await slack.say({ channel: "C1", text: "approve" });
  });

  await then(
    'the URL got one "message" event with the text "approve", signed with the signing secret of fakes.slack',
    async () => {
      const bodies = await signedBodies(receiver, "/events", slack.signingSecret);
      expect(bodies.map(({ signed }) => signed)).toEqual([true]);
      const { event } = JSON.parse(bodies[0]?.text ?? "{}");
      expect([event?.type, event?.text]).toEqual(["message", "approve"]);
    },
  );
});

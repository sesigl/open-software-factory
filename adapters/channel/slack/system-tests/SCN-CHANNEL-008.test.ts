import { scenario } from "@opensoftware/testkit";
import { CHANNEL, setup, thread } from "./channel.ts";

scenario("SCN-CHANNEL-008", async ({ sut, fakes, given, when, then }) => {
  let box: Awaited<ReturnType<typeof setup>>;
  let id = "";
  await given(
    'the client ran "ask" on a thread with "Deploy to production?" and the choices "ship" and "wait"',
    async () => {
      box = await setup(sut, fakes);
      id = await thread(box);
      await box.json(["ask", id, "Deploy to production?", "--choice", "ship", "--choice", "wait"]);
      expect(box.slack.messages(CHANNEL)[1]?.buttons.map((button) => button.actionId)).toEqual(["ship", "wait"]);
    },
  );

  let file = "";
  await given('a delivery of the person answering "approve" in that thread', async () => {
    // Slack's card has no button "approve": the person can only write it in the thread.
    const threadTs = box.slack.messages(CHANNEL)[0]?.ts;
    await box.slack.say({ channel: CHANNEL, text: "approve", threadTs });
    file = await box.delivery();
  });

  let run: Awaited<ReturnType<typeof box.run>>;
  await when('the client runs "receive" on it', async () => {
    run = await box.run(["receive", file]);
  });

  await then("receive exits with code 0 and prints nothing", async () => {
    expect(run.exitCode, run.stderr).toBe(0);
    expect(run.stdout).toBe("");
  });
});

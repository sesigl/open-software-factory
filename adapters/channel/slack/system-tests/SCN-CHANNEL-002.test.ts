import { scenario } from "@opensoftware/testkit";
import { CHANNEL, setup } from "./channel.ts";

scenario("SCN-CHANNEL-002", async ({ sut, fakes, given, when, then }) => {
  let box: Awaited<ReturnType<typeof setup>>;
  let file = "";
  await given('a delivery of the person\'s message "Lunch at noon?" without a mention of the bot', async () => {
    box = await setup(sut, fakes);
    await box.slack.say({ channel: CHANNEL, text: "Lunch at noon?" });
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

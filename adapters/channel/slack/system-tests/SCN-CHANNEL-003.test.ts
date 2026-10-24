import { scenario } from "@opensoftware/testkit";
import { mention, setup } from "./channel.ts";

scenario("SCN-CHANNEL-003", async ({ sut, fakes, given, when, then }) => {
  let box: Awaited<ReturnType<typeof setup>>;
  let file = "";
  await given(
    'a delivery of the bot\'s own message that mentions the bot with "Fix the checkout button on Safari"',
    async () => {
      box = await setup(sut, fakes);
      file = (await mention(box, "Fix the checkout button on Safari", box.slack.bot)).file;
    },
  );

  let run: Awaited<ReturnType<typeof box.run>>;
  await when('the client runs "receive" on it', async () => {
    run = await box.run(["receive", file]);
  });

  await then("receive exits with code 0 and prints nothing", async () => {
    expect(run.exitCode, run.stderr).toBe(0);
    expect(run.stdout).toBe("");
  });
});

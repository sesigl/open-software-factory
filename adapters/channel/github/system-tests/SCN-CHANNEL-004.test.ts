import { scenario } from "@opensoftware/testkit";
import { mention, setup } from "./channel.ts";

scenario("SCN-CHANNEL-004", async ({ sut, fakes, given, when, then }) => {
  let box: Awaited<ReturnType<typeof setup>>;
  let file = "";
  await given(
    'a delivery of the person\'s message that mentions the bot with "Fix the checkout button on Safari"',
    async () => {
      box = await setup(sut, fakes);
      file = (await mention(box)).file;
      // The same delivery passes with the right secret, so only the secret differs below.
      expect((await box.run(["receive", file])).exitCode).toBe(0);
    },
  );

  let run: Awaited<ReturnType<typeof box.run>>;
  await when('the client runs "receive" on it with "CHANNEL_SIGNING_SECRET" set to "other-secret"', async () => {
    run = await box.run(["receive", file], { CHANNEL_SIGNING_SECRET: "other-secret" });
  });

  await then("receive exits with code 1 and an error that names the signature", async () => {
    expect(run.exitCode, run.stderr).toBe(1);
    expect(run.stderr).toBe("channel-github: the delivery's signature does not match CHANNEL_SIGNING_SECRET\n");
  });

  await then("receive prints nothing", async () => {
    expect(run.stdout).toBe("");
  });
});

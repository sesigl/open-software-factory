import { scenario } from "@opensoftware/testkit";
import { mention, setup } from "./channel.ts";

scenario("SCN-CSLACK-001", async ({ sut, fakes, given, when, then }) => {
  let box: Awaited<ReturnType<typeof setup>>;
  let file = "";
  await given('a delivery of the person\'s message that Slack signed at "2026-01-01T00:00:00Z"', async () => {
    box = await setup(sut, fakes);
    file = (await mention(box)).file;
    // fakes.slack signs with the fixed clock; five minutes later the same delivery still passes.
    expect((await box.run(["receive", file], { OSF_NOW: "2026-01-01T00:05:00Z" })).exitCode).toBe(0);
  });

  let run: Awaited<ReturnType<typeof box.run>>;
  await when('the client runs "receive" on it with "OSF_NOW" set to "2026-01-01T00:05:01Z"', async () => {
    run = await box.run(["receive", file], { OSF_NOW: "2026-01-01T00:05:01Z" });
  });

  await then("receive exits with code 1 and an error that names the signature", async () => {
    expect(run.exitCode, run.stderr).toBe(1);
    expect(run.stderr).toBe("channel-slack: the delivery's signature does not match CHANNEL_SIGNING_SECRET\n");
  });
});

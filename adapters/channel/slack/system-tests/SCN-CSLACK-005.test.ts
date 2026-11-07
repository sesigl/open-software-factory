import { scenario } from "@opensoftware/testkit";
import { CHANNEL, setup } from "./channel.ts";

scenario("SCN-CSLACK-005", async ({ sut, fakes, when, then }) => {
  let box: Awaited<ReturnType<typeof setup>>;
  let suffixed: Awaited<ReturnType<typeof box.run>>;
  let prefixed: Awaited<ReturnType<typeof box.run>>;
  let channel: Awaited<ReturnType<typeof box.run>>;
  await when(
    'the client runs "reply" with "On it" to "slack:C0WEB:1767225600.000100x", "xslack:C0WEB:1767225600.000100" and "xslack:C0WEB"',
    async () => {
      box = await setup(sut, fakes);
      suffixed = await box.run(["reply", `slack:${CHANNEL}:1767225600.000100x`, "On it"]);
      prefixed = await box.run(["reply", `xslack:${CHANNEL}:1767225600.000100`, "On it"]);
      channel = await box.run(["reply", `xslack:${CHANNEL}`, "On it"]);
    },
  );

  await then(
    'each reply exits with code 2 and the error "channel-slack: name the thread as slack:<channel>:<ts> or a channel as slack:<channel>"',
    async () => {
      const error = "channel-slack: name the thread as slack:<channel>:<ts> or a channel as slack:<channel>\n";
      const runs = [suffixed, prefixed, channel];
      expect(
        runs.map((run) => run.exitCode),
        runs.map((run) => run.stderr).join(""),
      ).toEqual([2, 2, 2]);
      expect(runs.map((run) => run.stderr)).toEqual([error, error, error]);
    },
  );

  await then('the test chat shows no message in the channel "C0WEB"', async () => {
    expect(box.slack.messages(CHANNEL)).toEqual([]);
  });
});

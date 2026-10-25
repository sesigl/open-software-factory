import { runChannel } from "@opensoftware/channel-kit";
import { scenario } from "@opensoftware/testkit";
import { capture, demo, type Ran } from "./channel.ts";

scenario("SCN-CKIT-008", async ({ given, when, then }) => {
  let box: ReturnType<typeof demo>;
  await given('the channel "demo" whose thread "demo:7" holds the messages "On it" and "Done"', async () => {
    box = demo({ threads: { "demo:7": ["On it", "Done"] } });
  });

  let ran: Ran;
  await when('the adapter runs "messages demo:7"', async () => {
    ran = await capture((io) => runChannel(box.channel, ["messages", "demo:7"], io));
  });

  await then('standard output is two JSON lines with the texts "On it" and "Done" in that order', async () => {
    expect(ran.exitCode, ran.stderr).toBe(0);
    expect(ran.stdout).toBe(
      `${JSON.stringify({ id: "m-0", thread: "demo:7", text: "On it" })}\n${JSON.stringify({ id: "m-1", thread: "demo:7", text: "Done" })}\n`,
    );
  });
});

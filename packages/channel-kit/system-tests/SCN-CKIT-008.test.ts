import { runChannel, type Said } from "@opensoftware/channel-kit";
import { scenario } from "@opensoftware/testkit";
import { capture, demo, type Ran } from "./channel.ts";

const SAID: Said[] = [
  { id: "m-1", thread: "demo:7", person: "demo:U1", time: "2026-01-01T00:00:00Z", text: "approve", mine: false },
  { id: "m-2", thread: "demo:7", person: "demo:BOT", time: "2026-01-01T00:01:00Z", text: "Approved.", mine: true },
];

scenario("SCN-CKIT-008", async ({ given, when, then }) => {
  let box: ReturnType<typeof demo>;
  await given(
    'the channel "demo" whose history of "demo:7" gives the messages "m-1" of "demo:U1" and "m-2" of the bot',
    async () => {
      box = demo({ said: SAID });
    },
  );

  let ran: Ran;
  await when('the adapter runs "history demo:7"', async () => {
    ran = await capture((io) => runChannel(box.channel, ["history", "demo:7"], io));
  });

  await then('standard output is the JSON lines of "m-1" and "m-2" in this order, "m-2" with "mine" true', async () => {
    expect(ran.exitCode, ran.stderr).toBe(0);
    expect(ran.stdout).toBe(SAID.map((said) => `${JSON.stringify(said)}\n`).join(""));
  });
});

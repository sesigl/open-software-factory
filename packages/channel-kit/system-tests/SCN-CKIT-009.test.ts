import { runChannel } from "@opensoftware/channel-kit";
import { scenario } from "@opensoftware/testkit";
import { capture, demo, type Ran } from "./channel.ts";

scenario("SCN-CKIT-009", async ({ given, when, then }) => {
  let box: ReturnType<typeof demo>;
  await given(
    'the channel "demo" whose channels have the form "demo" and whose post starts the thread "demo:8" with the ID "m-3"',
    async () => {
      box = demo({ starts: "demo:8", id: "m-3" });
    },
  );

  let ran: Ran;
  await when("the adapter runs 'reply demo \"Deploy 42?\"'", async () => {
    ran = await capture((io) => runChannel(box.channel, ["reply", "demo", "Deploy 42?"], io));
  });

  await then('the channel posted the text "Deploy 42?" in "demo"', async () => {
    expect(ran.exitCode, ran.stderr).toBe(0);
    expect(box.posts).toEqual([{ thread: "demo", post: { text: "Deploy 42?" } }]);
  });

  await then('standard output is the JSON line {"thread": "demo:8", "id": "m-3"}', async () => {
    expect(ran.stdout).toBe(`${JSON.stringify({ thread: "demo:8", id: "m-3" })}\n`);
  });
});

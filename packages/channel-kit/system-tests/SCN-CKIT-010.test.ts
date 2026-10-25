import { runChannel } from "@opensoftware/channel-kit";
import { scenario } from "@opensoftware/testkit";
import { capture, demo, type Ran } from "./channel.ts";

const TIME = "2026-01-01T00:00:00.000001Z";

scenario("SCN-CKIT-010", async ({ given, when, then }) => {
  let box: ReturnType<typeof demo>;
  await given(
    'the channel "demo" with the channel "demo", whose post gives the ID "m-3" in the new thread "demo:9" at "2026-01-01T00:00:00.000001Z"',
    async () => {
      box = demo({ channels: true, posted: { id: "m-3", thread: "demo:9", time: TIME } });
    },
  );

  let ran: Ran;
  await when("the adapter runs 'reply demo \"Approval needed\"'", async () => {
    ran = await capture((io) => runChannel(box.channel, ["reply", "demo", "Approval needed"], io));
  });

  await then('the channel posted the text "Approval needed" in "demo"', async () => {
    expect(ran.exitCode, ran.stderr).toBe(0);
    expect(box.posts).toEqual([{ thread: "demo", post: { text: "Approval needed" } }]);
  });

  await then(
    'standard output is the JSON line {"thread": "demo:9", "id": "m-3", "time": "2026-01-01T00:00:00.000001Z"}',
    async () => {
      expect(ran.stdout).toBe(`${JSON.stringify({ thread: "demo:9", id: "m-3", time: TIME })}\n`);
    },
  );
});

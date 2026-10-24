import { runChannel } from "@opensoftware/channel-kit";
import { scenario } from "@opensoftware/testkit";
import { capture, demo, type Ran } from "./channel.ts";

scenario("SCN-CKIT-005", async ({ given, when, then }) => {
  let box: ReturnType<typeof demo>;
  await given('the channel "demo" whose post gives the ID "m-1"', async () => {
    box = demo({ id: "m-1" });
  });

  let ran: Ran;
  await when("the adapter runs 'reply demo:7 \"On it\"'", async () => {
    ran = await capture((io) => runChannel(box.channel, ["reply", "demo:7", "On it"], io));
  });

  await then('the channel posted the text "On it" in "demo:7"', async () => {
    expect(ran.exitCode, ran.stderr).toBe(0);
    expect(box.posts).toEqual([{ thread: "demo:7", post: { text: "On it" } }]);
  });

  await then('standard output is the JSON line {"thread": "demo:7", "id": "m-1"}', async () => {
    expect(ran.exitCode, ran.stderr).toBe(0);
    expect(ran.stdout).toBe(`${JSON.stringify({ thread: "demo:7", id: "m-1" })}\n`);
  });
});

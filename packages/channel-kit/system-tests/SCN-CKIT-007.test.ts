import { runChannel } from "@opensoftware/channel-kit";
import { scenario } from "@opensoftware/testkit";
import { capture, demo, type Ran } from "./channel.ts";

scenario("SCN-CKIT-007", async ({ given, when, then }) => {
  let box: ReturnType<typeof demo>;
  await given('the channel "demo" whose threads have the form "demo:<number>"', async () => {
    box = demo();
  });

  let ran: Ran;
  await when("the adapter runs 'reply slack:C0WEB:1 \"On it\"'", async () => {
    ran = await capture((io) => runChannel(box.channel, ["reply", "slack:C0WEB:1", "On it"], io));
  });

  await then("the exit code is 2", async () => {
    expect(ran.exitCode).toBe(2);
  });

  await then('standard error is "demo: name the thread as demo:<number>"', async () => {
    expect(ran.stderr).toBe("demo: name the thread as demo:<number>\n");
  });

  await then("the channel posted nothing", async () => {
    expect([ran.exitCode, box.posts]).toEqual([2, []]);
  });
});

import { runChannel } from "@opensoftware/channel-kit";
import { scenario } from "@opensoftware/testkit";
import { capture, demo, type Ran } from "./channel.ts";

scenario("SCN-CKIT-009", async ({ sut, given, when, then }) => {
  let box: ReturnType<typeof demo>;
  await given('the channel "demo"', async () => {
    box = demo();
  });

  await given('the delivery file "delivery.json" with the body "hello"', async () => {
    await sut.files.put("$INPUT/delivery.json", JSON.stringify({ headers: {}, body: "hello" }));
  });

  let ran: Ran;
  await when('the adapter runs "receive delivery.json --thread demo:7 --thread demo:8"', async () => {
    const args = ["receive", sut.files.path("$INPUT/delivery.json"), "--thread", "demo:7", "--thread", "demo:8"];
    ran = await capture((io) => runChannel(box.channel, args, io));
  });

  await then('the channel was asked to follow "demo:7" and "demo:8"', async () => {
    expect(ran.exitCode, ran.stderr).toBe(0);
    expect(box.followed).toEqual([["demo:7", "demo:8"]]);
  });
});

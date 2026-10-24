import { runChannel } from "@opensoftware/channel-kit";
import { scenario } from "@opensoftware/testkit";
import { capture, demo, type Ran } from "./channel.ts";

scenario("SCN-CKIT-004", async ({ sut, given, when, then }) => {
  let box: ReturnType<typeof demo>;
  await given('the channel "demo"', async () => {
    box = demo({ handle: async (_request, keep) => keep(Promise.resolve({ said: "never" })) });
  });

  await given('the delivery file "delivery.json" with headers and no body', async () => {
    await sut.files.put("$INPUT/delivery.json", JSON.stringify({ headers: { "x-demo": "1" } }));
  });

  let ran: Ran;
  await when('the adapter runs "receive delivery.json"', async () => {
    ran = await capture((io) => runChannel(box.channel, ["receive", sut.files.path("$INPUT/delivery.json")], io));
  });

  await then("the exit code is 2", async () => {
    expect(ran.exitCode).toBe(2);
  });

  await then('standard error names the form {"headers": {...}, "body": "..."}', async () => {
    const file = sut.files.path("$INPUT/delivery.json");
    expect(ran.stderr).toBe(`demo: ${file} holds {"headers": {...}, "body": "..."}\n`);
    expect(ran.stdout).toBe("");
  });
});

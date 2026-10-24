import { runChannel } from "@opensoftware/channel-kit";
import { scenario } from "@opensoftware/testkit";
import { capture, demo, type Ran } from "./channel.ts";

scenario("SCN-CKIT-001", async ({ sut, given, when, then }) => {
  let box: ReturnType<typeof demo>;
  await given(
    'the channel "demo" whose webhook hands the delivery\'s body to a handler that keeps it as the line "said"',
    async () => {
      box = demo({ handle: async (request, keep) => keep(request.text().then((said) => ({ said }))) });
    },
  );

  await given('the delivery file "delivery.json" with the body "hello"', async () => {
    await sut.files.put("$INPUT/delivery.json", JSON.stringify({ headers: { "x-demo": "1" }, body: "hello" }));
  });

  let ran: Ran;
  await when('the adapter runs "receive delivery.json"', async () => {
    ran = await capture((io) => runChannel(box.channel, ["receive", sut.files.path("$INPUT/delivery.json")], io));
  });

  await then("the exit code is 0", async () => {
    expect(ran.exitCode, ran.stderr).toBe(0);
  });

  await then('standard output is the JSON line {"said": "hello"}', async () => {
    expect(ran.stdout).toBe(`${JSON.stringify({ said: "hello" })}\n`);
  });
});

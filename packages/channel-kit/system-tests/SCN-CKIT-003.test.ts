import { runChannel } from "@opensoftware/channel-kit";
import { scenario } from "@opensoftware/testkit";
import { capture, demo, type Ran } from "./channel.ts";

scenario("SCN-CKIT-003", async ({ sut, given, when, then }) => {
  let box: ReturnType<typeof demo>;
  await given(
    'the channel "demo" whose webhook hands the delivery to a handler that fails with "the channel refused the token"',
    async () => {
      box = demo({
        handle: async (_request, keep) => {
          await keep(Promise.resolve({ said: "first" }));
          await keep(Promise.reject(new Error("the channel refused the token")));
        },
      });
    },
  );

  await given('the delivery file "delivery.json" with the body "hello"', async () => {
    await sut.files.put("$INPUT/delivery.json", JSON.stringify({ headers: {}, body: "hello" }));
  });

  let ran: Ran;
  await when('the adapter runs "receive delivery.json"', async () => {
    ran = await capture((io) => runChannel(box.channel, ["receive", sut.files.path("$INPUT/delivery.json")], io));
  });

  await then("the exit code is 1", async () => {
    expect(ran.exitCode).toBe(1);
  });

  await then('standard error is "demo: the channel refused the token"', async () => {
    expect(ran.stderr).toBe("demo: the channel refused the token\n");
  });

  await then("standard output is empty", async () => {
    expect(ran.stdout).toBe("");
  });
});

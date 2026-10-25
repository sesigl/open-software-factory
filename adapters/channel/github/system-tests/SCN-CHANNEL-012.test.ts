import { scenario } from "@opensoftware/testkit";
import { setup, thread } from "./channel.ts";

scenario("SCN-CHANNEL-012", async ({ sut, fakes, given, when, then }) => {
  let box: Awaited<ReturnType<typeof setup>>;
  await given("a work item that receive printed for the person's message", async () => {
    box = await setup(sut, fakes);
    await thread(box);
  });

  let file = "";
  await given('a delivery of the person\'s message "approve" in its thread', async () => {
    file = await box.delivery(await box.github.say(box.pr, "approve"));
  });

  let run: Awaited<ReturnType<typeof box.run>>;
  await when('the client runs "receive" on it', async () => {
    run = await box.run(["receive", file]);
  });

  await then("receive exits with code 0 and prints nothing", async () => {
    expect([run.exitCode, run.stdout], run.stderr).toEqual([0, ""]);
  });
});

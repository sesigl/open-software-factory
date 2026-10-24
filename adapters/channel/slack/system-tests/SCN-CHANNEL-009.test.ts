import { scenario } from "@opensoftware/testkit";
import { CHANNEL, setup, thread } from "./channel.ts";

scenario("SCN-CHANNEL-009", async ({ sut, fakes, given, when, then }) => {
  let box: Awaited<ReturnType<typeof setup>>;
  let id = "";
  await given("a work item that receive printed for the person's message", async () => {
    box = await setup(sut, fakes);
    id = await thread(box);
  });

  let run: Awaited<ReturnType<typeof box.run>>;
  await when('the client runs "reply" on its thread with "CHANNEL_TOKEN" set to "not-a-token"', async () => {
    run = await box.run(["reply", id, "On it"], { CHANNEL_TOKEN: "not-a-token" });
  });

  await then('reply exits with code 1 and the error "the channel refused the token"', async () => {
    expect(run.exitCode, run.stderr).toBe(1);
    expect(run.stderr).toBe("channel-slack: the channel refused the token\n");
    expect(box.slack.messages(CHANNEL)).toHaveLength(1);
  });
});

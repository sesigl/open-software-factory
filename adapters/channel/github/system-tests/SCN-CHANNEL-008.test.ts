import { scenario } from "@opensoftware/testkit";
import { setup, thread } from "./channel.ts";

scenario("SCN-CHANNEL-008", async ({ sut, fakes, given, when, then }) => {
  let box: Awaited<ReturnType<typeof setup>>;
  let id = "";
  await given(
    'the client ran "ask" on a thread with "Deploy to production?" and the choices "ship" and "wait"',
    async () => {
      box = await setup(sut, fakes);
      id = await thread(box);
      await box.json(["ask", id, "Deploy to production?", "--choice", "ship", "--choice", "wait"]);
      expect((await box.github.conversation(box.pr))[1]?.body).toContain("Answer with /ship or /wait.");
    },
  );

  let file = "";
  await given('a delivery of the person answering "approve" in that thread', async () => {
    const said = await box.github.say(box.pr, "/approve");
    file = await box.delivery(said);
  });

  let run: Awaited<ReturnType<typeof box.run>>;
  await when('the client runs "receive" on it', async () => {
    run = await box.run(["receive", file]);
  });

  await then("receive exits with code 0 and prints nothing", async () => {
    expect(run.exitCode, run.stderr).toBe(0);
    expect(run.stdout).toBe("");
  });
});

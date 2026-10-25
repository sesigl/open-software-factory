import { scenario } from "@opensoftware/testkit";
import { PERSON, setup, thread } from "./channel.ts";

scenario("SCN-CHANNEL-010", async ({ sut, fakes, given, when, then }) => {
  let box: Awaited<ReturnType<typeof setup>>;
  let id = "";
  await given("a work item that receive printed for the person's message", async () => {
    box = await setup(sut, fakes);
    id = await thread(box);
  });

  await given('the client ran "reply" on its thread with "On it: run 7 started"', async () => {
    await box.json(["reply", id, "On it: run 7 started"]);
  });

  let lines: Record<string, unknown>[] = [];
  await when('the client runs "messages" on that thread', async () => {
    const run = await box.run(["messages", id]);
    expect(run.exitCode, run.stderr).toBe(0);
    lines = run.stdout
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line) as Record<string, unknown>);
  });

  await then("messages prints the person's message and then the bot's message \"On it: run 7 started\"", async () => {
    expect(lines.map((line) => line.text)).toEqual([
      "@tester Fix the checkout button on Safari",
      "On it: run 7 started",
    ]);
  });

  await then('the person\'s message has the person as its author and "mine" false', async () => {
    expect(lines[0]).toMatchObject({ author: `github:${PERSON}`, mine: false });
  });

  await then('the bot\'s message has "mine" true', async () => {
    expect(lines[1]).toMatchObject({ author: `github:${box.github.owner}`, mine: true });
  });

  await then("each message has its ID, the thread and its time", async () => {
    const comments = await box.github.conversation(box.pr);
    expect(lines.map((line) => line.id)).toEqual(comments.map((comment) => String(comment.id)));
    for (const line of lines) expect(line.thread).toBe(id);
    for (const line of lines) expect(Date.parse(String(line.time))).not.toBeNaN();
  });
});

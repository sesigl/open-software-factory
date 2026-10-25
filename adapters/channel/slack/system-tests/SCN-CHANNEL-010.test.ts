import { scenario } from "@opensoftware/testkit";
import { CHANNEL, PERSON, setup, thread } from "./channel.ts";

scenario("SCN-CHANNEL-010", async ({ sut, fakes, given, when, then }) => {
  let box: Awaited<ReturnType<typeof setup>>;
  let id = "";
  await given("a work item that receive printed for the person's message", async () => {
    box = await setup(sut, fakes);
    id = await thread(box);
  });

  let reply: Record<string, unknown>;
  await given('the client ran "reply" on its thread with "On it: run 7 started"', async () => {
    reply = await box.json(["reply", id, "On it: run 7 started"]);
  });

  let lines: Record<string, unknown>[];
  await when('the client runs "history" on its thread', async () => {
    const run = await box.run(["history", id]);
    expect(run.exitCode, run.stderr).toBe(0);
    lines = run.stdout
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line) as Record<string, unknown>);
  });

  await then("history prints the person's message and then the bot's message \"On it: run 7 started\"", async () => {
    expect(lines.map((line) => line.text)).toEqual([
      `<@${box.slack.bot}> Fix the checkout button on Safari`,
      "On it: run 7 started",
    ]);
  });

  await then(
    'the person\'s message names the person and has "mine" false, and the bot\'s message has "mine" true',
    async () => {
      expect(lines.map(({ person, mine }) => ({ person, mine }))).toEqual([
        { person: `slack:${PERSON}`, mine: false },
        { person: `slack:${box.slack.bot}`, mine: true },
      ]);
    },
  );

  await then("the bot's message has the ID and the time that reply printed", async () => {
    const [first, second] = box.slack.messages(CHANNEL);
    expect(lines[1]).toMatchObject({ id: reply.id, time: reply.time });
    expect(lines[0]?.id).toBe(first?.ts);
    expect(reply.id).toBe(second?.ts);
    expect(reply.time).toMatch(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{6}Z$/);
  });
});

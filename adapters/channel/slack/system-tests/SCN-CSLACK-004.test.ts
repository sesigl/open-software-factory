import { scenario } from "@opensoftware/testkit";
import { CHANNEL, PERSON, setup } from "./channel.ts";

scenario("SCN-CSLACK-004", async ({ sut, fakes, given, when, then }) => {
  let box: Awaited<ReturnType<typeof setup>>;
  await given('the bot\'s message "Deploy 42 waits for approval" at the top of the channel "C0WEB"', async () => {
    box = await setup(sut, fakes);
    await box.json(["reply", `slack:${CHANNEL}`, "Deploy 42 waits for approval"]);
  });

  await given('the person\'s message "Lunch at noon?" after it', async () => {
    await box.slack.say({ channel: CHANNEL, text: "Lunch at noon?", user: PERSON });
  });

  let lines: Record<string, unknown>[] = [];
  await when('the client runs "messages slack:C0WEB"', async () => {
    const run = await box.run(["messages", `slack:${CHANNEL}`]);
    expect(run.exitCode, run.stderr).toBe(0);
    lines = run.stdout
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line) as Record<string, unknown>);
  });

  await then(
    'messages prints "Deploy 42 waits for approval" with "mine" true and then "Lunch at noon?" with "mine" false',
    async () => {
      expect(lines.map(({ text, mine }) => ({ text, mine }))).toEqual([
        { text: "Deploy 42 waits for approval", mine: true },
        { text: "Lunch at noon?", mine: false },
      ]);
    },
  );

  await then('each message\'s thread is "slack:C0WEB:" and its ID', async () => {
    for (const line of lines) expect(line.thread).toBe(`slack:${CHANNEL}:${line.id}`);
  });

  await then("each message's time has the microseconds of its ID", async () => {
    for (const line of lines) {
      const [seconds, fraction] = String(line.id).split(".");
      expect(line.time).toBe(`${new Date(Number(seconds) * 1000).toISOString().slice(0, 19)}.${fraction}Z`);
    }
  });
});

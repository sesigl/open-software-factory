import { scenario } from "@opensoftware/testkit";
import { CHANNEL, setup } from "./channel.ts";

scenario("SCN-CSLACK-003", async ({ sut, fakes, given, when, then }) => {
  let box: Awaited<ReturnType<typeof setup>>;
  await given('the person\'s message "Lunch at noon?" in "C0WEB" and a reply "Yes" in its thread', async () => {
    box = await setup(sut, fakes);
    const lunch = await box.slack.say({ channel: CHANNEL, text: "Lunch at noon?" });
    await box.slack.say({ channel: CHANNEL, text: "Yes", threadTs: lunch.ts });
  });

  await given('the client ran "reply" on "slack:C0WEB" with "Approval needed from maintainers"', async () => {
    await box.json(["reply", `slack:${CHANNEL}`, "Approval needed from maintainers"]);
  });

  let lines: Record<string, unknown>[];
  await when('the client runs "history" on "slack:C0WEB"', async () => {
    const run = await box.run(["history", `slack:${CHANNEL}`]);
    expect(run.exitCode, run.stderr).toBe(0);
    lines = run.stdout
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line) as Record<string, unknown>);
  });

  await then(
    'history prints "Lunch at noon?" and then "Approval needed from maintainers" with "mine" true, and not "Yes"',
    async () => {
      expect(lines.map(({ text, mine }) => ({ text, mine }))).toEqual([
        { text: "Lunch at noon?", mine: false },
        { text: "Approval needed from maintainers", mine: true },
      ]);
    },
  );
});

import { scenario } from "@opensoftware/testkit";
import { openPullRequest, setup } from "./forge.ts";

scenario("SCN-FORGE-028", async ({ sut, fakes, given, when, then }) => {
  let box: Awaited<ReturnType<typeof setup>>;
  let pr: Awaited<ReturnType<typeof openPullRequest>>;
  await given('an open pull request in "tester/web"', async () => {
    box = await setup(sut, fakes);
    pr = await openPullRequest(box.forge);
  });

  let posted: Record<string, unknown>;
  await given('the client ran "comment" on it with the text "Evidence attached"', async () => {
    posted = await box.json(["comment", "tester/web", String(pr.number), "Evidence attached"]);
  });

  await given('the person "reviewer" commented "Looks good" on it', async () => {
    await box.forge.say(pr, "Looks good");
  });

  let lines: Record<string, unknown>[];
  await when('the client runs "comments" for it', async () => {
    const run = await box.run(["comments", "tester/web", String(pr.number)]);
    expect(run.exitCode, run.stderr).toBe(0);
    lines = run.stdout
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line) as Record<string, unknown>);
  });

  await then(
    'comments prints "Evidence attached" by "tester" with "mine" true and then "Looks good" by "reviewer" with "mine" false',
    async () => {
      expect(lines.map(({ text, person, mine }) => ({ text, person, mine }))).toEqual([
        { text: "Evidence attached", person: "github:tester", mine: true },
        { text: "Looks good", person: "github:reviewer", mine: false },
      ]);
    },
  );

  await then("the first comment has the ID and the time that comment printed", async () => {
    expect(lines[0]).toMatchObject({ id: posted.id, time: posted.time });
    expect(lines[1]?.time).toMatch(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/);
  });
});

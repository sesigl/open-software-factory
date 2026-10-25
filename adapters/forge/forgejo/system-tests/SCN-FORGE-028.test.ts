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
  await given('the client ran "comment" on it with the text "Evidence: 14 scenarios passed"', async () => {
    posted = await box.json(["comment", "tester/web", String(pr.number), "Evidence: 14 scenarios passed"]);
  });

  await given('the person "reviewer" commented "Looks good" on it later', async () => {
    await box.forge.say(pr, "Looks good");
  });

  let lines: Record<string, unknown>[] = [];
  await when('the client runs "comments" for it', async () => {
    const run = await box.run(["comments", "tester/web", String(pr.number)]);
    expect(run.exitCode, run.stderr).toBe(0);
    lines = run.stdout
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line) as Record<string, unknown>);
  });

  await then(
    'comments prints two lines with the texts "Evidence: 14 scenarios passed" and "Looks good" in that order',
    async () => {
      expect(lines.map((line) => line.text)).toEqual(["Evidence: 14 scenarios passed", "Looks good"]);
    },
  );

  await then('the first line has the author "tester" behind the adapter\'s name and "mine" true', async () => {
    expect(lines[0]).toMatchObject({ author: "forgejo:tester", mine: true });
  });

  await then('the second line has the author "reviewer" behind the adapter\'s name and "mine" false', async () => {
    expect(lines[1]).toMatchObject({ author: "forgejo:reviewer", mine: false });
  });

  await then("each line has the comment's ID, URL and time", async () => {
    expect(lines[0]).toMatchObject({ id: posted.id, url: posted.url });
    expect(lines[1]?.url).toMatch(new RegExp(`#issuecomment-${lines[1]?.id}$`));
    for (const line of lines) expect(Date.parse(String(line.time))).not.toBeNaN();
    expect(Date.parse(String(lines[0]?.time))).toBeLessThanOrEqual(Date.parse(String(lines[1]?.time)));
  });
});

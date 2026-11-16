import { scenario } from "@opensoftware/testkit";
import { openPullRequest, setup } from "./forge.ts";

const TEXTS = Array.from({ length: 120 }, (_, index) => `Comment ${index + 1}`);

scenario("SCN-FORGE-046", async ({ sut, fakes, given, when, then }) => {
  let box: Awaited<ReturnType<typeof setup>>;
  let pr: Awaited<ReturnType<typeof openPullRequest>>;
  await given(
    'an open pull request in "tester/web" with the 120 comments "Comment 1" to "Comment 120" by the person "reviewer"',
    async () => {
      box = await setup(sut, fakes);
      pr = await openPullRequest(box.forge);
      for (const text of TEXTS) await box.forge.say(pr, text);
    },
  );

  let lines: Record<string, unknown>[] = [];
  await when('the client runs "comments" for it', async () => {
    const run = await box.run(["comments", "tester/web", String(pr.number)]);
    expect(run.exitCode, run.stderr).toBe(0);
    lines = run.stdout
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line) as Record<string, unknown>);
  });

  await then('comments prints 120 lines with the texts "Comment 1" to "Comment 120" in that order', async () => {
    expect(lines.map((line) => line.text)).toEqual(TEXTS);
  });
});

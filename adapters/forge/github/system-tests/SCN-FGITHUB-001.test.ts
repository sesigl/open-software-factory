import { scenario } from "@opensoftware/testkit";
import { openPullRequest, setup } from "./forge.ts";

scenario("SCN-FGITHUB-001", async ({ sut, fakes, given, when, then }) => {
  let box: Awaited<ReturnType<typeof setup>>;
  let pr: Awaited<ReturnType<typeof openPullRequest>>;
  await given('an open pull request in "tester/web"', async () => {
    box = await setup(sut, fakes);
    pr = await openPullRequest(box.forge);
  });

  let actions: Record<string, string>;
  await given(
    'the client ran "comment" on it with the text "Evidence: 14 scenarios passed" with a GitHub Actions token',
    async () => {
      actions = { FORGE_TOKEN: box.forge.actionsToken };
      const run = await box.run(["comment", "tester/web", String(pr.number), "Evidence: 14 scenarios passed"], actions);
      expect(run.exitCode, run.stderr).toBe(0);
    },
  );

  let run: Awaited<ReturnType<typeof box.run>>;
  await when('the client runs "comments" for it with that token', async () => {
    run = await box.run(["comments", "tester/web", String(pr.number)], actions);
  });

  await then('comments prints the comment with the author "github:github-actions[bot]" and "mine" true', async () => {
    expect(run.exitCode, run.stderr).toBe(0);
    expect(JSON.parse(run.stdout)).toMatchObject({
      text: "Evidence: 14 scenarios passed",
      author: "github:github-actions[bot]",
      mine: true,
    });
  });
});

import { type FakeGitHub, type PullRequest, scenario } from "@opensoftware/testkit";
import { type GitHubAnswer, githubClient } from "./github.ts";

scenario("SCN-TK-099", async ({ fakes, given, when, then }) => {
  let github: FakeGitHub;
  let pr: PullRequest;
  await given("pull request 1 in fakes.github and its actions token", async () => {
    github = await fakes.github();
    await github.createRepository("demo");
    pr = await github.openPullRequest("demo", { branch: "fix", title: "Fix the typo", files: { "notes.md": "hi\n" } });
  });

  let user: GitHubAnswer;
  await when(
    'a module reads "GET /user" and comments on pull request 1 with that token through GitHub\'s API',
    async () => {
      const api = githubClient(github, { token: github.actionsToken });
      user = await api("GET", "/user");
      await api("POST", "/repos/tester/demo/issues/1/comments", { body: "Evidence attached" });
    },
  );

  await then('"GET /user" answers 403 and the comment is by "github-actions[bot]"', async () => {
    expect(String(user.status)).toBe("403");
    expect(await github.conversation(pr)).toEqual([
      { id: expect.any(Number), user: "github-actions[bot]", body: "Evidence attached" },
    ]);
  });
});

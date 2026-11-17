import { type FakeGitHub, scenario } from "@opensoftware/testkit";
import { type GitHubAnswer, githubClient } from "./github.ts";

scenario("SCN-TK-092", async ({ fakes, given, when, then }) => {
  let github: FakeGitHub;
  await given(
    'pull request 1 in fakes.github, on which the test had "reviewer" say "@tester fix the typo"',
    async () => {
      github = await fakes.github();
      await github.createRepository("demo");
      const pr = await github.openPullRequest("demo", {
        branch: "fix",
        title: "Fix the typo",
        files: { "notes.md": "hi\n" },
      });
      await github.say(pr, "@tester fix the typo");
    },
  );

  let user: GitHubAnswer;
  let comments: GitHubAnswer;
  await when(
    'a module reads the "login" of "GET /user" and the comments of pull request 1 through GitHub\'s API',
    async () => {
      const api = githubClient(github);
      user = await api("GET", "/user");
      comments = await api("GET", "/repos/tester/demo/issues/1/comments");
    },
  );

  await then('the answers are "tester" and one comment, "reviewer:@tester fix the typo"', async () => {
    const lines = comments.json.map((comment: { user: { login: string }; body: string }) => {
      return `${comment.user.login}:${comment.body}`;
    });
    expect([user.json.login, ...lines].join(" ")).toBe("tester reviewer:@tester fix the typo");
  });
});

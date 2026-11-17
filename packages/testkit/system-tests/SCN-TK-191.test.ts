import { type FakeGitHub, scenario } from "@opensoftware/testkit";
import { type GitHubAnswer, githubClient } from "./github.ts";

scenario("SCN-TK-191", async ({ fakes, given, when, then }) => {
  let github: FakeGitHub;
  await given(
    'pull request 1 in fakes.github, on which the test had "reviewer" say "Comment 1" to "Comment 102"',
    async () => {
      github = await fakes.github();
      await github.createRepository("demo");
      const pr = await github.openPullRequest("demo", { branch: "fix", title: "Fix", files: { "fix.md": "1\n" } });
      for (let n = 1; n <= 102; n++) await github.say(pr, `Comment ${n}`);
    },
  );

  let first: GitHubAnswer;
  let second: GitHubAnswer;
  await when(
    "a module reads the first page of the comments of pull request 1 and page 2 of 100 per page through GitHub's API",
    async () => {
      const api = githubClient(github, { repository: "demo" });
      first = await api("GET", "/issues/1/comments");
      second = await api("GET", "/issues/1/comments?per_page=100&page=2");
    },
  );

  await then('the first page has 30 comments and page 2 has "Comment 101" and "Comment 102"', async () => {
    const texts = second.json.map((comment: { body: string }) => comment.body);
    expect([first.json.length, ...texts].join(" ")).toBe("30 Comment 101 Comment 102");
  });
});

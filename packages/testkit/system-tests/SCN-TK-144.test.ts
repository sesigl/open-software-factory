import { type FakeGitHub, type PullRequest, scenario } from "@opensoftware/testkit";
import { type GitHubAnswer, githubClient } from "./github.ts";

scenario("SCN-TK-144", async ({ fakes, given, when, then }) => {
  let github: FakeGitHub;
  let pr: PullRequest;
  await given("a pull request in fakes.github with a check run on its head commit", async () => {
    github = await fakes.github();
    await github.createRepository("demo");
    pr = await github.openPullRequest("demo", { branch: "fix", title: "Fix", files: { "fix.md": "1\n" } });
    await github.checkRun(pr, { name: "verify", conclusion: "success" });
  });

  let answer: GitHubAnswer;
  await when(
    "a module reads the check runs of its head commit through GitHub's API with the token of fakes.github that may not read check runs",
    async () => {
      const api = githubClient(github, { repository: "demo", token: github.noChecksToken });
      answer = await api("GET", `/commits/${pr.sha}/check-runs`);
    },
  );

  await then("the answer's status is 403", async () => {
    expect(String(answer.status)).toBe("403");
  });
});

import { type FakeGitHub, type PullRequest, scenario } from "@opensoftware/testkit";
import { type GitHubAnswer, githubClient } from "./github.ts";

scenario("SCN-TK-143", async ({ fakes, given, when, then }) => {
  let github: FakeGitHub;
  let pr: PullRequest;
  await given(
    'a pull request in fakes.github to whose head commit the test added the check runs "lint" queued, "test" failed and "verify" succeeded',
    async () => {
      github = await fakes.github();
      await github.createRepository("demo");
      pr = await github.openPullRequest("demo", { branch: "fix", title: "Fix", files: { "fix.md": "1\n" } });
      await github.checkRun(pr, { name: "lint" });
      await github.checkRun(pr, { name: "test", conclusion: "failure" });
      await github.checkRun(pr, { name: "verify", conclusion: "success" });
    },
  );

  let answer: GitHubAnswer;
  await when(
    "a module reads page 2 of the check runs of the head commit, 2 per page, through GitHub's API",
    async () => {
      answer = await githubClient(github, { repository: "demo" })(
        "GET",
        `/commits/${pr.sha}/check-runs?per_page=2&page=2`,
      );
    },
  );

  await then('the answer has the total 3 and the one check run "verify" completed with "success"', async () => {
    const runs = answer.json.check_runs.map((run: { name: string; status: string; conclusion: string }) => {
      return [run.name, run.status, run.conclusion].join(" ");
    });
    expect([answer.json.total_count, ...runs].join(" ")).toBe("3 verify completed success");
  });
});

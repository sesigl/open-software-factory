import { type FakeGitHub, type PullRequest, scenario } from "@opensoftware/testkit";
import { type GitHubAnswer, githubClient, requireVerify } from "./github.ts";

scenario("SCN-TK-086", async ({ fakes, given, when, then }) => {
  let github: FakeGitHub;
  let pr: PullRequest;
  await given("a pull request in fakes.github", async () => {
    github = await fakes.github();
    await github.createRepository("demo");
    pr = await github.openPullRequest("demo", { branch: "fix", title: "Add notes", files: { "notes.md": "hello\n" } });
  });

  let merged: GitHubAnswer;
  await when(
    'a module protects "main" with the required check "verify" for admins too and merges the pull request through GitHub\'s API',
    async () => {
      await requireVerify(github, "demo");
      merged = await githubClient(github, { repository: "demo" })("PUT", `/pulls/${pr.number}/merge`, {});
    },
  );

  await then(
    "the answer is '405 Required status check \"verify\" is expected.' and the pull request is open",
    async () => {
      expect(`${merged.status} ${merged.json.message}`).toBe('405 Required status check "verify" is expected.');
      expect((await github.pullRequests("demo"))[0]?.state).toBe("open");
    },
  );
});

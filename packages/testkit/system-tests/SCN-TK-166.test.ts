import { type FakeGitHub, scenario } from "@opensoftware/testkit";
import { type GitHubAnswer, githubClient } from "./github.ts";

scenario("SCN-TK-166", async ({ fakes, given, when, then }) => {
  let github: FakeGitHub;
  await given('a pull request from "fix" in fakes.github', async () => {
    github = await fakes.github();
    await github.createRepository("demo");
    await github.openPullRequest("demo", { branch: "fix", title: "Fix", files: { "fix.md": "1\n" } });
  });

  let closed: GitHubAnswer;
  let first: GitHubAnswer;
  let second: GitHubAnswer;
  await when(
    "a module closes pull request 1 and deletes the ref of its branch twice through GitHub's API",
    async () => {
      const api = githubClient(github, { repository: "demo" });
      closed = await api("PATCH", "/pulls/1", { state: "closed" });
      first = await api("DELETE", `/git/refs/heads/${closed.json.head.ref}`);
      second = await api("DELETE", `/git/refs/heads/${closed.json.head.ref}`);
    },
  );

  await then(
    'the answers are "closed", not merged, 204 and 422, the pull request is closed and the branch "fix" is gone',
    async () => {
      expect(`${closed.json.state} ${closed.json.merged} ${first.status} ${second.status}`).toBe(
        "closed false 204 422",
      );
      expect((await github.pullRequests("demo"))[0]?.state).toBe("closed");
      expect((await github.branches("demo")).map((branch) => branch.name)).toEqual(["main"]);
    },
  );
});

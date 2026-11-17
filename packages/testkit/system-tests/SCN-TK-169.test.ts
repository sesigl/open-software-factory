import { type FakeGitHub, scenario } from "@opensoftware/testkit";
import { autoMerge, type GitHubAnswer, githubClient, requireVerify } from "./github.ts";

scenario("SCN-TK-169", async ({ fakes, given, when, then }) => {
  let github: FakeGitHub;
  await given("a pull request in fakes.github whose repository allows auto-merge", async () => {
    github = await fakes.github();
    await github.createRepository("demo");
    await github.allowAutoMerge("demo");
    await github.openPullRequest("demo", { branch: "fix", title: "Fix", files: { "fix.md": "1\n" } });
  });

  let state = "";
  let before: GitHubAnswer;
  let after: GitHubAnswer;
  let merged: GitHubAnswer;
  await when(
    'a module requires the check "verify" on "main", reads the merge state of pull request 1 with GitHub\'s GraphQL API, enables auto-merge with the method "SQUASH" and posts "verify" as "success" on its head',
    async () => {
      const api = githubClient(github, { repository: "demo" });
      const graphql = autoMerge(github, "demo");
      await requireVerify(github, "demo");
      state = (await graphql.state()).mergeStateStatus;
      await graphql.enable("SQUASH");
      before = await api("GET", "/pulls/1");
      await api("POST", `/statuses/${before.json.head.sha}`, { state: "success", context: "verify" });
      after = await api("GET", "/pulls/1");
      merged = await api("GET", `/commits/${after.json.merge_commit_sha}`);
    },
  );

  await then(
    'the merge state was "BLOCKED", the pull request was open before and merged after, with a merge commit of one parent',
    async () => {
      const output = `${state} ${before.json.state} ${after.json.merged} ${merged.json.parents.length}`;
      expect(output).toBe("BLOCKED open true 1");
      expect(await github.file("demo", "fix.md", "main")).toBe("1\n");
    },
  );
});

import { type FakeGitHub, type PullRequest, scenario } from "@opensoftware/testkit";
import { type GitHubAnswer, githubClient } from "./github.ts";

scenario("SCN-TK-085", async ({ fakes, given, when, then }) => {
  let github: FakeGitHub;
  let pr: PullRequest;
  await given('a pull request in fakes.github that creates "notes.md"', async () => {
    github = await fakes.github();
    await github.createRepository("demo", { "app.js": "1\n" });
    pr = await github.openPullRequest("demo", { branch: "fix", title: "Add notes", files: { "notes.md": "hello\n" } });
  });

  let merged: GitHubAnswer;
  await when('a module merges it with the method "squash" through GitHub\'s API', async () => {
    const api = githubClient(github, { repository: "demo" });
    merged = await api("PUT", `/pulls/${pr.number}/merge`, { merge_method: "squash" });
  });

  await then('"main" is at the merge commit it got back and holds "notes.md"', async () => {
    const main = (await github.branches("demo")).find((branch) => branch.name === "main");
    expect(main?.sha).toBe(merged.json.sha);
    expect(merged.json.sha).not.toBe(pr.sha);
    expect(await github.file("demo", "notes.md", "main")).toBe("hello\n");
    expect(await github.file("demo", "app.js", "main")).toBe("1\n");
    expect((await github.pullRequests("demo"))[0]?.state).toBe("closed");
  });
});

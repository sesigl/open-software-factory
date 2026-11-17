import { type FakeGitHub, scenario } from "@opensoftware/testkit";
import { type GitHubAnswer, githubClient } from "./github.ts";

scenario("SCN-TK-084", async ({ fakes, given, when, then }) => {
  let github: FakeGitHub;
  let sha = "";
  await given('the repository "demo" in fakes.github with the branch "fix"', async () => {
    github = await fakes.github();
    await github.createRepository("demo", { "app.js": "1\n" });
    sha = await github.createBranch("demo", { branch: "fix", files: { "notes.md": "hello\n" } });
  });

  let opened: GitHubAnswer;
  await when(
    'a module opens a pull request from "fix", sets the status "proof" to "success" on its head commit and comments "evidence bundle attached" through GitHub\'s API',
    async () => {
      const api = githubClient(github, { repository: "demo" });
      opened = await api("POST", "/pulls", { head: "fix", base: "main", title: "Fix the typo", body: "Closes #3" });
      await api("POST", `/statuses/${opened.json.head.sha}`, { state: "success", context: "proof", description: "ok" });
      await api("POST", `/issues/${opened.json.number}/comments`, { body: "evidence bundle attached" });
    },
  );

  await then("fakes.github shows that pull request, that status and that comment", async () => {
    const number: number = opened.json.number;
    expect(opened.json.head.sha).toBe(sha);
    expect(await github.pullRequests("demo")).toEqual([
      {
        number,
        title: "Fix the typo",
        body: "Closes #3",
        head: "fix",
        base: "main",
        state: "open",
        url: `${github.url}/tester/demo/pull/${number}`,
      },
    ]);
    const pr = { repository: "demo", number, url: "", sha };
    expect(await github.statuses(pr)).toEqual([{ context: "proof", state: "success", description: "ok" }]);
    expect(await github.comments(pr)).toEqual(["evidence bundle attached"]);
  });
});

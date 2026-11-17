import { type FakeGitHub, scenario } from "@opensoftware/testkit";
import { githubClient } from "./github.ts";

scenario("SCN-TK-113", async ({ fakes, given, when, then }) => {
  let github: FakeGitHub;
  await given(
    'pull requests from "fix" and "docs" in fakes.github, of which the test merged "docs" and approved "fix" as "reviewer"',
    async () => {
      github = await fakes.github();
      await github.createRepository("demo");
      const fix = await github.openPullRequest("demo", { branch: "fix", title: "Fix", files: { "fix.md": "1\n" } });
      const docs = await github.openPullRequest("demo", { branch: "docs", title: "Docs", files: { "docs.md": "1\n" } });
      await github.mergePullRequest(docs);
      await github.review(fix, "APPROVED", "Good");
    },
  );

  let lines: string[] = [];
  await when("a module reads the open pull requests and the reviews of each through GitHub's API", async () => {
    const api = githubClient(github, { repository: "demo" });
    const pulls = await api("GET", "/pulls?state=open&per_page=100");
    lines = [];
    for (const pull of pulls.json) {
      const reviews = await api("GET", `/pulls/${pull.number}/reviews`);
      lines = [...lines, [pull.head.ref, ...reviews.json.map((review: { state: string }) => review.state)].join(" ")];
    }
  });

  await then('the one open pull request is from "fix", with the one review "APPROVED"', async () => {
    expect(lines.join("\n")).toBe("fix APPROVED");
  });
});

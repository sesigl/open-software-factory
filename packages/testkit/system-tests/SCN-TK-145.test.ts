import { type FakeGitHub, scenario } from "@opensoftware/testkit";
import { type GitHubAnswer, githubClient } from "./github.ts";

scenario("SCN-TK-145", async ({ fakes, given, when, then }) => {
  let github: FakeGitHub;
  await given(
    'the issue "Export reports as CSV" that the test opened in fakes.github, gave the label "factory" and took it from again',
    async () => {
      github = await fakes.github();
      await github.createRepository("demo");
      const issue = await github.openIssue("demo", { title: "Export reports as CSV" });
      await github.label("demo", issue.number, "factory");
      await github.unlabel("demo", issue.number, "factory");
    },
  );

  let issue: GitHubAnswer;
  await when("a module reads issue 1 through GitHub's API", async () => {
    issue = await githubClient(github, { repository: "demo" })("GET", "/issues/1");
  });

  await then('issue 1 has the title "Export reports as CSV" and 0 labels', async () => {
    expect(`${issue.json.title}: ${issue.json.labels.length} labels`).toBe("Export reports as CSV: 0 labels");
  });
});

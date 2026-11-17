import { type FakeGitHub, scenario } from "@opensoftware/testkit";
import { type GitHubAnswer, githubClient } from "./github.ts";

scenario("SCN-TK-102", async ({ fakes, given, when, then }) => {
  let github: FakeGitHub;
  await given(
    'the issue "Export reports as CSV" that the test opened in fakes.github and gave the label "factory"',
    async () => {
      github = await fakes.github();
      await github.createRepository("demo");
      const issue = await github.openIssue("demo", { title: "Export reports as CSV" });
      await github.label("demo", issue.number, "factory");
    },
  );

  let issue: GitHubAnswer;
  await when("a module reads issue 1 through GitHub's API", async () => {
    issue = await githubClient(github, { repository: "demo" })("GET", "/issues/1");
  });

  await then('issue 1 has the title "Export reports as CSV" and the one label "factory"', async () => {
    const labels = issue.json.labels.map((label: { name: string }) => label.name).join(",");
    expect(`${issue.json.title} ${labels}`).toBe("Export reports as CSV factory");
  });
});

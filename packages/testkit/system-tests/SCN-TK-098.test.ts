import { type FakeGitHub, scenario } from "@opensoftware/testkit";
import { type GitHubAnswer, githubClient } from "./github.ts";

scenario("SCN-TK-098", async ({ fakes, given, when, then }) => {
  let github: FakeGitHub;
  await given('pull request 1 in fakes.github that changes "checkout.js"', async () => {
    github = await fakes.github();
    await github.createRepository("demo");
    await github.openPullRequest("demo", { branch: "fix", title: "Fix checkout", files: { "checkout.js": "fixed\n" } });
  });

  let files: GitHubAnswer;
  let pull: GitHubAnswer;
  await when(
    'a module reads the files of pull request 1, and its labels and "draft", through GitHub\'s API',
    async () => {
      const api = githubClient(github, { repository: "demo" });
      files = await api("GET", "/pulls/1/files");
      pull = await api("GET", "/pulls/1");
    },
  );

  await then('the answers are "checkout.js", no label and "draft" false', async () => {
    const names = files.json.map((file: { filename: string }) => file.filename).join(",");
    expect(`${names} ${JSON.stringify(pull.json.labels)} ${pull.json.draft}`).toBe("checkout.js [] false");
  });
});

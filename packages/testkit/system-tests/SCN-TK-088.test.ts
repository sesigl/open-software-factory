import { type FakeGitHub, scenario } from "@opensoftware/testkit";
import { type GitHubAnswer, githubClient } from "./github.ts";

scenario("SCN-TK-088", async ({ fakes, given, when, then }) => {
  let github: FakeGitHub;
  await given('the repository "demo" in fakes.github', async () => {
    github = await fakes.github();
    await github.createRepository("demo");
  });

  let read: GitHubAnswer;
  await when('a module reads it through GitHub\'s API with the token "not-a-token"', async () => {
    read = await githubClient(github, { repository: "demo", token: "not-a-token" })("GET", "");
  });

  await then('the answer is "401 Bad credentials"', async () => {
    expect(`${read.status} ${read.json.message}`).toBe("401 Bad credentials");
  });
});

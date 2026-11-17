import { type FakeGitHub, scenario } from "@opensoftware/testkit";
import { type GitHubAnswer, githubClient } from "./github.ts";

scenario("SCN-TK-095", async ({ fakes, given, when, then }) => {
  let github: FakeGitHub;
  await given('the repository "demo" in fakes.github', async () => {
    github = await fakes.github();
    await github.createRepository("demo");
  });

  let removed: GitHubAnswer;
  await when('a module registers a webhook for "push" events and then deletes it through GitHub\'s API', async () => {
    const api = githubClient(github, { repository: "demo" });
    const created = await api("POST", "/hooks", {
      name: "web",
      config: { url: "http://intake.example/github", content_type: "json" },
      events: ["push"],
    });
    removed = await api("DELETE", `/hooks/${created.json.id}`);
  });

  await then("the delete answers 204 and fakes.github lists no webhook of the repository", async () => {
    expect(String(removed.status)).toBe("204");
    expect(await github.hooks("demo")).toEqual([]);
  });
});

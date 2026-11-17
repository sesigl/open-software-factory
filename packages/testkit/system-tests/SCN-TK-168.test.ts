import { type FakeGitHub, scenario } from "@opensoftware/testkit";
import { type GitHubAnswer, githubClient } from "./github.ts";

scenario("SCN-TK-168", async ({ fakes, given, when, then }) => {
  let github: FakeGitHub;
  await given('the repository "demo" in fakes.github with the branch "fix"', async () => {
    github = await fakes.github();
    await github.createRepository("demo");
    await github.createBranch("demo", { branch: "fix", files: { "notes.md": "hello\n" } });
  });

  let back: GitHubAnswer;
  let forced: GitHubAnswer;
  await when(
    'a module moves "fix" to the head commit of "main" without force and then with force through GitHub\'s API',
    async () => {
      const api = githubClient(github, { repository: "demo" });
      const sha = (await api("GET", "/git/ref/heads/main")).json.object.sha;
      back = await api("PATCH", "/git/refs/heads/fix", { sha });
      forced = await api("PATCH", "/git/refs/heads/fix", { sha, force: true });
    },
  );

  await then(
    'the first answers "422 Update is not a fast forward", the second 200, and "fix" is at the head commit of "main"',
    async () => {
      expect(`${back.status} ${back.json.message} ${forced.status}`).toBe("422 Update is not a fast forward 200");
      const [fix, main] = await github.branches("demo");
      expect(fix?.sha).toBe(main?.sha);
    },
  );
});

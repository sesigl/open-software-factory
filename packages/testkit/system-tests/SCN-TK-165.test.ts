import { type FakeGitHub, scenario } from "@opensoftware/testkit";
import { type GitHubAnswer, githubClient } from "./github.ts";

scenario("SCN-TK-165", async ({ fakes, given, when, then }) => {
  let github: FakeGitHub;
  await given('the repository "demo" in fakes.github with the branch "dev"', async () => {
    github = await fakes.github();
    await github.createRepository("demo");
    await github.createBranch("demo", { branch: "dev", files: { "dev.md": "dev\n" } });
  });

  let main: GitHubAnswer;
  let dev: GitHubAnswer;
  await when(
    'a module protects "main" with the required check "verify" and one approval, and reads the protection of "main" and of "dev" through GitHub\'s API',
    async () => {
      const api = githubClient(github, { repository: "demo" });
      await api("PUT", "/branches/main/protection", {
        required_status_checks: { strict: false, contexts: ["verify"] },
        enforce_admins: true,
        required_pull_request_reviews: { required_approving_review_count: 1 },
        restrictions: null,
      });
      main = await api("GET", "/branches/main/protection");
      dev = await api("GET", "/branches/dev/protection");
    },
  );

  await then(
    'the protection of "main" has the check "verify" and 1 approval, and that of "dev" answers "404 Branch not protected"',
    async () => {
      const checks = main.json.required_status_checks.contexts.join(",");
      const approvals = main.json.required_pull_request_reviews.required_approving_review_count;
      expect(`${checks} ${approvals} ${dev.status} ${dev.json.message}`).toBe("verify 1 404 Branch not protected");
    },
  );
});

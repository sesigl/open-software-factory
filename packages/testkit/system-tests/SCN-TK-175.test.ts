import { type FakeGitHub, scenario } from "@opensoftware/testkit";
import { type GitHubAnswer, githubClient } from "./github.ts";

scenario("SCN-TK-175", async ({ fakes, given, when, then }) => {
  let github: FakeGitHub;
  await given(
    'the repository "demo" in fakes.github with a ruleset that requires the check "factory" and one approval on "main"',
    async () => {
      github = await fakes.github();
      await github.createRepository("demo");
      await github.addRuleset("demo", { branches: ["main"], checks: ["factory"], approvals: 1 });
    },
  );

  let main: GitHubAnswer;
  let dev: GitHubAnswer;
  await when('a module reads the rules for "main" and for "dev" through GitHub\'s API', async () => {
    const api = githubClient(github, { repository: "demo" });
    main = await api("GET", "/rules/branches/main");
    dev = await api("GET", "/rules/branches/dev");
  });

  await then(
    'the rules for "main" are "required_status_checks factory" and "pull_request 1", and "dev" has none',
    async () => {
      const lines = main.json.map(
        (rule: {
          type: string;
          parameters: { required_approving_review_count: number; required_status_checks: { context: string }[] };
        }) =>
          rule.type === "pull_request"
            ? `${rule.type} ${rule.parameters.required_approving_review_count}`
            : `${rule.type} ${rule.parameters.required_status_checks.map((check) => check.context).join(",")}`,
      );
      expect([...lines, String(dev.json.length)].join("\n")).toBe("required_status_checks factory\npull_request 1\n0");
    },
  );
});

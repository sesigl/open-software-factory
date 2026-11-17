import { type FakeGitHub, scenario } from "@opensoftware/testkit";
import { autoMerge, requireVerify } from "./github.ts";

scenario("SCN-TK-171", async ({ fakes, given, when, then }) => {
  let github: FakeGitHub;
  await given("a pull request in fakes.github whose repository allows auto-merge", async () => {
    github = await fakes.github();
    await github.createRepository("demo");
    await github.allowAutoMerge("demo");
    await github.openPullRequest("demo", { branch: "fix", title: "Fix", files: { "fix.md": "1\n" } });
  });

  let output = "";
  await when(
    'a module requires the check "verify" on "main" and enables auto-merge of pull request 1 with the method "SQUASH" with GitHub\'s GraphQL API',
    async () => {
      const graphql = autoMerge(github, "demo");
      await requireVerify(github, "demo");
      const before = await graphql.state();
      await graphql.enable("SQUASH");
      const after = await graphql.state();
      output = `${before.autoMergeRequest} ${after.autoMergeRequest.mergeMethod}`;
    },
  );

  await then(
    'the pull request had no auto-merge request before and has one with the merge method "SQUASH" after',
    async () => {
      expect(output).toBe("null SQUASH");
    },
  );
});

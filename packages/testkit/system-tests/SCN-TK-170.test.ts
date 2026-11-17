import { type FakeGitHub, scenario } from "@opensoftware/testkit";
import { autoMerge } from "./github.ts";

scenario("SCN-TK-170", async ({ fakes, given, when, then }) => {
  let github: FakeGitHub;
  await given("a pull request in fakes.github whose repository does not allow auto-merge", async () => {
    github = await fakes.github();
    await github.createRepository("demo");
    await github.openPullRequest("demo", { branch: "fix", title: "Fix", files: { "fix.md": "1\n" } });
  });

  let outputs: string[] = [];
  await when(
    "a module reads the merge state of pull request 1 with GitHub's GraphQL API and enables auto-merge, before and after the test allows auto-merge in the repository",
    async () => {
      const graphql = autoMerge(github, "demo");
      const attempt = async () => {
        const state = (await graphql.state()).mergeStateStatus;
        const enabled = await graphql.enable("MERGE");
        outputs = [...outputs, `${state} ${enabled.errors[0].message}`];
      };
      await attempt();
      await github.allowAutoMerge("demo");
      await attempt();
    },
  );

  await then("GitHub's errors name the setting and the clean status, and the pull request is open", async () => {
    expect(outputs).toEqual([
      "CLEAN Pull request Auto merge is not allowed for this repository",
      "CLEAN Pull request Pull request is in clean status",
    ]);
    expect((await github.pullRequests("demo"))[0]?.state).toBe("open");
  });
});

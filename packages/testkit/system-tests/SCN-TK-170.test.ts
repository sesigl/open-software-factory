import { scenario } from "@opensoftware/testkit";
import { demoModule, GITHUB_README, testCases } from "./module.ts";

scenario("SCN-TK-170", async ({ sut, given, when, then }) => {
  let bin = "";
  await given(
    "a module whose CLI reads the merge state of pull request 1 with GitHub's GraphQL API, enables auto-merge and prints the merge state and GitHub's error at \"DEMO_GITHUB_URL\"",
    async () => {
      bin = [
        "const graphql = (query, variables) =>",
        "  fetch(`${process.env.DEMO_GITHUB_URL}/graphql`, {",
        '    method: "POST",',
        "    headers: { authorization: `Bearer ${process.env.DEMO_GITHUB_TOKEN}` },",
        "    body: JSON.stringify({ query, variables }),",
        "  }).then((response) => response.json());",
        "const state = await graphql(",
        '  "query($owner: String!, $name: String!, $number: Int!) { repository(owner: $owner, name: $name) { autoMergeAllowed pullRequest(number: $number) { id mergeStateStatus } } }",',
        '  { owner: "tester", name: "demo", number: 1 },',
        ");",
        "const pull = state.data.repository.pullRequest;",
        "const enabled = await graphql(",
        '  "mutation($id: ID!, $method: PullRequestMergeMethod!) { enablePullRequestAutoMerge(input: { pullRequestId: $id, mergeMethod: $method }) { clientMutationId } }",',
        '  { id: pull.id, method: "MERGE" },',
        ");",
        "process.stdout.write(`${pull.mergeStateStatus} ${enabled.errors[0].message}`);",
        "",
      ].join("\n");
    },
  );

  await given(
    'its system test runs it before and after it allows auto-merge in the repository of fakes.github and expects "CLEAN Pull request Auto merge is not allowed for this repository" and "CLEAN Pull request Pull request is in clean status"',
    async () => {
      const module = demoModule({
        bin,
        readme: GITHUB_README,
        steps: [
          'When the user runs "demo" before and after the repository allows auto-merge',
          "Then the outputs name the setting and the clean status, and the pull request is open",
        ],
        test: [
          "const github = await fakes.github();",
          'await github.createRepository("demo");',
          'await github.openPullRequest("demo", { branch: "fix", title: "Fix", files: { "fix.md": "1\\n" } });',
          "const env = { DEMO_GITHUB_URL: github.url, DEMO_GITHUB_TOKEN: github.token };",
          "let before: Awaited<ReturnType<typeof sut.cli>>;",
          "let after: Awaited<ReturnType<typeof sut.cli>>;",
          "await when('the user runs \"demo\" before and after the repository allows auto-merge', async () => {",
          "  before = await sut.cli([], { env });",
          '  await github.allowAutoMerge("demo");',
          "  after = await sut.cli([], { env });",
          "});",
          "await then('the outputs name the setting and the clean status, and the pull request is open', async () => {",
          '  expect(before.stdout).toBe("CLEAN Pull request Auto merge is not allowed for this repository");',
          '  expect(after.stdout).toBe("CLEAN Pull request Pull request is in clean status");',
          '  expect((await github.pullRequests("demo"))[0]?.state).toBe("open");',
          "});",
        ],
      });
      for (const [path, content] of Object.entries(module)) await sut.files.put(path, content);
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "testkit run --junit report.xml" in the module', async () => {
    run = await sut.cli(["run", "--junit", "report.xml"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then('"report.xml" has the passed test case "SCN-DEMO-001"', async () => {
    expect(testCases(await sut.files.read("$INPUT/report.xml"))).toContainEqual({
      name: "SCN-DEMO-001",
      failed: false,
    });
  });
});

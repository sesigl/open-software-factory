import { scenario } from "@opensoftware/testkit";
import { demoModule, GITHUB_API, GITHUB_README, testCases } from "./module.ts";

scenario("SCN-TK-169", async ({ sut, given, when, then }) => {
  let bin = "";
  await given(
    'a module whose CLI requires the check "verify" on "main", reads the merge state of pull request 1 with GitHub\'s GraphQL API, enables auto-merge with the method "SQUASH", posts "verify" as "success" on its head and prints the merge state, the state before, "merged" after and the merge commit\'s number of parents at "DEMO_GITHUB_URL"',
    async () => {
      bin = [
        ...GITHUB_API,
        "const graphql = (query, variables) =>",
        "  fetch(`${process.env.DEMO_GITHUB_URL}/graphql`, {",
        '    method: "POST",',
        "    headers: { authorization: `Bearer ${process.env.DEMO_GITHUB_TOKEN}` },",
        "    body: JSON.stringify({ query, variables }),",
        "  }).then((response) => response.json());",
        'await api("PUT", "/branches/main/protection", {',
        '  required_status_checks: { strict: false, contexts: ["verify"] },',
        "  enforce_admins: true,",
        "  required_pull_request_reviews: null,",
        "  restrictions: null,",
        "});",
        "const state = await graphql(",
        '  "query($owner: String!, $name: String!, $number: Int!) { repository(owner: $owner, name: $name) { autoMergeAllowed pullRequest(number: $number) { id mergeStateStatus } } }",',
        '  { owner: "tester", name: repository.split("/")[1], number: 1 },',
        ");",
        "const pull = state.data.repository.pullRequest;",
        "await graphql(",
        '  "mutation($id: ID!, $method: PullRequestMergeMethod!) { enablePullRequestAutoMerge(input: { pullRequestId: $id, mergeMethod: $method }) { clientMutationId } }",',
        '  { id: pull.id, method: "SQUASH" },',
        ");",
        'const before = await api("GET", "/pulls/1");',
        'await api("POST", `/statuses/${before.json.head.sha}`, { state: "success", context: "verify" });',
        'const after = await api("GET", "/pulls/1");',
        'const merged = await api("GET", `/commits/${after.json.merge_commit_sha}`);',
        "process.stdout.write(",
        "  `${pull.mergeStateStatus} ${before.json.state} ${after.json.merged} ${merged.json.parents.length}`,",
        ");",
        "",
      ].join("\n");
    },
  );

  await given(
    'its system test allows auto-merge in the repository of fakes.github, opens the pull request and expects "BLOCKED open true 1"',
    async () => {
      const module = demoModule({
        bin,
        readme: GITHUB_README,
        steps: ['When the user runs "demo"', 'Then the output is "BLOCKED open true 1"'],
        test: [
          "const github = await fakes.github();",
          'await github.createRepository("demo");',
          'await github.allowAutoMerge("demo");',
          'await github.openPullRequest("demo", { branch: "fix", title: "Fix", files: { "fix.md": "1\\n" } });',
          "let run: Awaited<ReturnType<typeof sut.cli>>;",
          "await when('the user runs \"demo\"', async () => {",
          "  const env = { DEMO_GITHUB_URL: github.url, DEMO_GITHUB_TOKEN: github.token };",
          "  run = await sut.cli([`${github.owner}/demo`], { env });",
          "});",
          "await then('the output is \"BLOCKED open true 1\"', async () => {",
          '  expect(run.stdout).toBe("BLOCKED open true 1");',
          '  expect(await github.file("demo", "fix.md", "main")).toBe("1\\n");',
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

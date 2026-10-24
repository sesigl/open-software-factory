import { scenario } from "@opensoftware/testkit";
import { demoModule, GITHUB_API, GITHUB_README, testCases } from "./module.ts";

scenario("SCN-TK-084", async ({ sut, given, when, then }) => {
  let bin = "";
  await given(
    'a module whose CLI opens a pull request from "fix", sets the status "proof" to "success" on its head commit and comments "evidence bundle attached" at "DEMO_GITHUB_URL"',
    async () => {
      bin = [
        ...GITHUB_API,
        'const pr = (await api("POST", "/pulls", { head: "fix", base: "main", title: "Fix the typo", body: "Closes #3" })).json;',
        'await api("POST", `/statuses/${pr.head.sha}`, { state: "success", context: "proof", description: "ok" });',
        'await api("POST", `/issues/${pr.number}/comments`, { body: "evidence bundle attached" });',
        "process.stdout.write(`${pr.number} ${pr.head.sha}`);",
        "",
      ].join("\n");
    },
  );

  await given(
    'its system test creates the branch "fix" in fakes.github and expects that pull request, that status and that comment',
    async () => {
      const module = demoModule({
        bin,
        readme: GITHUB_README,
        steps: ['When the user runs "demo"', 'Then the pull request from "fix" has the status "proof" and the comment'],
        test: [
          "const github = await fakes.github();",
          'await github.createRepository("demo", { "app.js": "1\\n" });',
          'const sha = await github.createBranch("demo", { branch: "fix", files: { "notes.md": "hello\\n" } });',
          "let run: Awaited<ReturnType<typeof sut.cli>>;",
          "await when('the user runs \"demo\"', async () => {",
          "  const env = { DEMO_GITHUB_URL: github.url, DEMO_GITHUB_TOKEN: github.token };",
          "  run = await sut.cli([`${github.owner}/demo`], { env });",
          "});",
          'await then(\'the pull request from "fix" has the status "proof" and the comment\', async () => {',
          '  const [number, head] = run.stdout.split(" ");',
          "  expect(head).toBe(sha);",
          '  expect(await github.pullRequests("demo")).toEqual([',
          '    { number: Number(number), title: "Fix the typo", body: "Closes #3", head: "fix", base: "main", state: "open", url: `${github.url}/tester/demo/pull/${number}` },',
          "  ]);",
          '  const pr = { repository: "demo", number: Number(number), url: "", sha };',
          '  expect(await github.statuses(pr)).toEqual([{ context: "proof", state: "success", description: "ok" }]);',
          '  expect(await github.comments(pr)).toEqual(["evidence bundle attached"]);',
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

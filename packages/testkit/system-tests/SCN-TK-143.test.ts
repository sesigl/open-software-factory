import { scenario } from "@opensoftware/testkit";
import { demoModule, GITHUB_README, testCases } from "./module.ts";

scenario("SCN-TK-143", async ({ sut, given, when, then }) => {
  let bin = "";
  await given(
    'a module whose CLI prints the total and the name, status and conclusion of each check run on page 2 of 2 per page at "DEMO_GITHUB_URL"',
    async () => {
      bin = [
        "const sha = process.argv[2];",
        "const response = await fetch(",
        "  `${process.env.DEMO_GITHUB_URL}/repos/tester/demo/commits/${sha}/check-runs?per_page=2&page=2`,",
        "  { headers: { authorization: `Bearer ${process.env.DEMO_GITHUB_TOKEN}` } },",
        ");",
        "const answer = await response.json();",
        "const runs = answer.check_runs.map((run) => [run.name, run.status, run.conclusion].join(' '));",
        "process.stdout.write([answer.total_count, ...runs].join(' '));",
        "",
      ].join("\n");
    },
  );

  await given(
    'its system test adds the check runs "lint" queued, "test" failed and "verify" succeeded to a pull request in fakes.github and expects "3 verify completed success"',
    async () => {
      const module = demoModule({
        bin,
        readme: GITHUB_README,
        steps: ['When the user runs "demo"', 'Then the output is "3 verify completed success"'],
        test: [
          "const github = await fakes.github();",
          'await github.createRepository("demo");',
          'const pr = await github.openPullRequest("demo", { branch: "fix", title: "Fix", files: { "fix.md": "1\\n" } });',
          'await github.checkRun(pr, { name: "lint" });',
          'await github.checkRun(pr, { name: "test", conclusion: "failure" });',
          'await github.checkRun(pr, { name: "verify", conclusion: "success" });',
          "let run: Awaited<ReturnType<typeof sut.cli>>;",
          "await when('the user runs \"demo\"', async () => {",
          "  run = await sut.cli([pr.sha], { env: { DEMO_GITHUB_URL: github.url, DEMO_GITHUB_TOKEN: github.token } });",
          "});",
          "await then('the output is \"3 verify completed success\"', async () => {",
          '  expect(run.stdout).toBe("3 verify completed success");',
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

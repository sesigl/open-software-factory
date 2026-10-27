import { scenario } from "@opensoftware/testkit";
import { demoModule, GITHUB_README, testCases } from "./module.ts";

scenario("SCN-TK-113", async ({ sut, given, when, then }) => {
  let bin = "";
  await given(
    'a module whose CLI prints the head branch of each open pull request and the review states of each at "DEMO_GITHUB_URL"',
    async () => {
      bin = [
        "const api = (path) =>",
        "  fetch(`${process.env.DEMO_GITHUB_URL}/repos/tester/demo${path}`, {",
        "    headers: { authorization: `Bearer ${process.env.DEMO_GITHUB_TOKEN}` },",
        "  }).then((response) => response.json());",
        'const pulls = await api("/pulls?state=open&per_page=100");',
        "const lines = [];",
        "for (const pull of pulls) {",
        "  const reviews = await api(`/pulls/${pull.number}/reviews`);",
        '  lines.push([pull.head.ref, ...reviews.map((review) => review.state)].join(" "));',
        "}",
        'process.stdout.write(lines.join("\\n"));',
        "",
      ].join("\n");
    },
  );

  await given(
    'its system test opens pull requests from "fix" and "docs" in fakes.github, merges "docs", approves "fix" as "reviewer" and expects "fix APPROVED"',
    async () => {
      const module = demoModule({
        bin,
        readme: GITHUB_README,
        steps: ['When the user runs "demo"', 'Then the output is "fix APPROVED"'],
        test: [
          "const github = await fakes.github();",
          'await github.createRepository("demo");',
          'const fix = await github.openPullRequest("demo", { branch: "fix", title: "Fix", files: { "fix.md": "1\\n" } });',
          'const docs = await github.openPullRequest("demo", { branch: "docs", title: "Docs", files: { "docs.md": "1\\n" } });',
          "await github.mergePullRequest(docs);",
          'await github.review(fix, "APPROVED", "Good");',
          "let run: Awaited<ReturnType<typeof sut.cli>>;",
          "await when('the user runs \"demo\"', async () => {",
          "  run = await sut.cli([], { env: { DEMO_GITHUB_URL: github.url, DEMO_GITHUB_TOKEN: github.token } });",
          "});",
          "await then('the output is \"fix APPROVED\"', async () => {",
          '  expect(run.stdout).toBe("fix APPROVED");',
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

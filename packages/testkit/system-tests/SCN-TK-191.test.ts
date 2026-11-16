import { scenario } from "@opensoftware/testkit";
import { demoModule, GITHUB_README, testCases } from "./module.ts";

scenario("SCN-TK-191", async ({ sut, given, when, then }) => {
  let bin = "";
  await given(
    'a module whose CLI prints the number of comments on the first page and the texts on page 2 of 100 per page of pull request 1 at "DEMO_GITHUB_URL"',
    async () => {
      bin = [
        "const api = (path) =>",
        "  fetch(`${process.env.DEMO_GITHUB_URL}/repos/tester/demo/issues/1/comments${path}`, {",
        "    headers: { authorization: `Bearer ${process.env.DEMO_GITHUB_TOKEN}` },",
        "  }).then((response) => response.json());",
        'const first = await api("");',
        'const second = await api("?per_page=100&page=2");',
        "process.stdout.write([first.length, ...second.map((comment) => comment.body)].join(' '));",
        "",
      ].join("\n");
    },
  );

  await given(
    'its system test has "reviewer" say "Comment 1" to "Comment 102" on pull request 1 and expects "30 Comment 101 Comment 102"',
    async () => {
      const module = demoModule({
        bin,
        readme: GITHUB_README,
        steps: ['When the user runs "demo"', 'Then the output is "30 Comment 101 Comment 102"'],
        test: [
          "const github = await fakes.github();",
          'await github.createRepository("demo");',
          'const pr = await github.openPullRequest("demo", { branch: "fix", title: "Fix", files: { "fix.md": "1\\n" } });',
          "for (let n = 1; n <= 102; n++) await github.say(pr, `Comment ${n}`);",
          "let run: Awaited<ReturnType<typeof sut.cli>>;",
          "await when('the user runs \"demo\"', async () => {",
          "  run = await sut.cli([], { env: { DEMO_GITHUB_URL: github.url, DEMO_GITHUB_TOKEN: github.token } });",
          "});",
          "await then('the output is \"30 Comment 101 Comment 102\"', async () => {",
          '  expect(run.stdout).toBe("30 Comment 101 Comment 102");',
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

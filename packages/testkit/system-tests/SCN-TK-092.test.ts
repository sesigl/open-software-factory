import { scenario } from "@opensoftware/testkit";
import { demoModule, GITHUB_README, testCases } from "./module.ts";

scenario("SCN-TK-092", async ({ sut, given, when, then }) => {
  let bin = "";
  await given(
    'a module whose CLI prints the "login" of "GET /user" and the author and text of each comment of pull request 1 at "DEMO_GITHUB_URL"',
    async () => {
      bin = [
        "const api = (path) =>",
        "  fetch(`${process.env.DEMO_GITHUB_URL}${path}`, {",
        "    headers: { authorization: `Bearer ${process.env.DEMO_GITHUB_TOKEN}` },",
        "  }).then((response) => response.json());",
        'const user = await api("/user");',
        'const comments = await api("/repos/tester/demo/issues/1/comments");',
        'process.stdout.write([user.login, ...comments.map((comment) => `${comment.user.login}:${comment.body}`)].join(" "));',
        "",
      ].join("\n");
    },
  );

  await given(
    'its system test has "reviewer" say "@tester fix the typo" on pull request 1 and expects "tester reviewer:@tester fix the typo"',
    async () => {
      const module = demoModule({
        bin,
        readme: GITHUB_README,
        steps: ['When the user runs "demo"', 'Then the output is "tester reviewer:@tester fix the typo"'],
        test: [
          "const github = await fakes.github();",
          'await github.createRepository("demo");',
          'const pr = await github.openPullRequest("demo", { branch: "fix", title: "Fix the typo", files: { "notes.md": "hi\\n" } });',
          'await github.say(pr, "@tester fix the typo");',
          "let run: Awaited<ReturnType<typeof sut.cli>>;",
          "await when('the user runs \"demo\"', async () => {",
          "  run = await sut.cli([], { env: { DEMO_GITHUB_URL: github.url, DEMO_GITHUB_TOKEN: github.token } });",
          "});",
          "await then('the output is \"tester reviewer:@tester fix the typo\"', async () => {",
          '  expect(run.stdout).toBe("tester reviewer:@tester fix the typo");',
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

import { scenario } from "@opensoftware/testkit";
import { demoModule, GITHUB_README, testCases } from "./module.ts";

scenario("SCN-TK-099", async ({ sut, given, when, then }) => {
  let bin = "";
  await given(
    'a module whose CLI prints the status of "GET /user" and the author of the comment it posts on pull request 1 at "DEMO_GITHUB_URL"',
    async () => {
      bin = [
        "const api = (path, init = {}) =>",
        "  fetch(`${process.env.DEMO_GITHUB_URL}${path}`, {",
        "    ...init,",
        "    headers: { authorization: `Bearer ${process.env.DEMO_GITHUB_TOKEN}` },",
        "  });",
        'const user = await api("/user");',
        'const posted = await api("/repos/tester/demo/issues/1/comments", { method: "POST", body: JSON.stringify({ body: "hi" }) });',
        "process.stdout.write(`${user.status} ${(await posted.json()).user.login}`);",
        "",
      ].join("\n");
    },
  );

  await given(
    'its system test runs it with the "actionsToken" of fakes.github and expects "403 github-actions[bot]"',
    async () => {
      const module = demoModule({
        bin,
        readme: GITHUB_README,
        steps: ['When the user runs "demo"', 'Then the output is "403 github-actions[bot]"'],
        test: [
          "const github = await fakes.github();",
          'await github.createRepository("demo");',
          'await github.openPullRequest("demo", { branch: "fix", title: "Fix the typo", files: { "notes.md": "hi\\n" } });',
          "let run: Awaited<ReturnType<typeof sut.cli>>;",
          "await when('the user runs \"demo\"', async () => {",
          "  run = await sut.cli([], { env: { DEMO_GITHUB_URL: github.url, DEMO_GITHUB_TOKEN: github.actionsToken } });",
          "});",
          "await then('the output is \"403 github-actions[bot]\"', async () => {",
          '  expect(run.stdout, run.stderr).toBe("403 github-actions[bot]");',
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

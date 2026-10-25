import { scenario } from "@opensoftware/testkit";
import { demoModule, GITHUB_README, testCases } from "./module.ts";

scenario("SCN-TK-098", async ({ sut, given, when, then }) => {
  let bin = "";
  await given(
    'a module whose CLI prints the status of "GET /user" and comments on pull request 1 with the token in "DEMO_GITHUB_TOKEN" at "DEMO_GITHUB_URL"',
    async () => {
      bin = [
        "const call = (method, path, body) =>",
        "  fetch(`${process.env.DEMO_GITHUB_URL}${path}`, {",
        "    method,",
        '    headers: { authorization: `Bearer ${process.env.DEMO_GITHUB_TOKEN}`, "content-type": "application/json" },',
        "    body: body && JSON.stringify(body),",
        "  });",
        'const user = await call("GET", "/user");',
        'await call("POST", "/repos/tester/demo/issues/1/comments", { body: "Evidence attached" });',
        "process.stdout.write(String(user.status));",
        "",
      ].join("\n");
    },
  );

  await given(
    'its system test passes the actions token of fakes.github and expects the status 403 and a comment by "github-actions[bot]"',
    async () => {
      const module = demoModule({
        bin,
        readme: GITHUB_README,
        steps: ['When the user runs "demo"', 'Then the output is "403" and the comment is by "github-actions[bot]"'],
        test: [
          "const github = await fakes.github();",
          'await github.createRepository("demo");',
          'const pr = await github.openPullRequest("demo", { branch: "fix", title: "Fix the typo", files: { "notes.md": "hi\\n" } });',
          "let run: Awaited<ReturnType<typeof sut.cli>>;",
          "await when('the user runs \"demo\"', async () => {",
          "  run = await sut.cli([], { env: { DEMO_GITHUB_URL: github.url, DEMO_GITHUB_TOKEN: github.actionsToken } });",
          "});",
          'await then(\'the output is "403" and the comment is by "github-actions[bot]"\', async () => {',
          '  expect(run.stdout).toBe("403");',
          '  expect(await github.conversation(pr)).toEqual([{ id: expect.any(Number), user: "github-actions[bot]", body: "Evidence attached" }]);',
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

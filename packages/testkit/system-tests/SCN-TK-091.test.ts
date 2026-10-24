import { scenario } from "@opensoftware/testkit";
import { demoModule, GITHUB_API, GITHUB_README, testCases } from "./module.ts";

scenario("SCN-TK-091", async ({ sut, given, when, then }) => {
  let bin = "";
  await given(
    'a module whose CLI registers a webhook for "issue_comment" events to the URL it is given at "DEMO_GITHUB_URL"',
    async () => {
      bin = [
        ...GITHUB_API,
        'await api("POST", "/hooks", {',
        '  name: "web",',
        '  config: { url: rest[0], content_type: "json", secret: "whsec-demo" },',
        '  events: ["issue_comment"],',
        "  active: true,",
        "});",
        "",
      ].join("\n");
    },
  );

  await given(
    'its system test passes the URL of fakes.http, has "reviewer" say "@tester fix the typo" on a pull request and expects an "issue_comment" delivery with that author and text',
    async () => {
      const module = demoModule({
        bin,
        readme: GITHUB_README,
        steps: [
          'When the user runs "demo" and "reviewer" says "@tester fix the typo" on a pull request',
          'Then the receiver gets an "issue_comment" delivery from "reviewer" with "@tester fix the typo"',
        ],
        test: [
          'const receiver = await fakes.http([{ method: "POST", path: "/github", body: {} }]);',
          "const github = await fakes.github();",
          'await github.createRepository("demo");',
          'const pr = await github.openPullRequest("demo", { branch: "fix", title: "Fix the typo", files: { "notes.md": "hi\\n" } });',
          'await when(\'the user runs "demo" and "reviewer" says "@tester fix the typo" on a pull request\', async () => {',
          "  const env = { DEMO_GITHUB_URL: github.url, DEMO_GITHUB_TOKEN: github.token };",
          "  await sut.cli([`${github.owner}/demo`, `${receiver.url}/github`], { env });",
          '  await github.say(pr, "@tester fix the typo");',
          "});",
          'await then(\'the receiver gets an "issue_comment" delivery from "reviewer" with "@tester fix the typo"\', async () => {',
          "  await expect.poll(() => receiver.headers().length, { timeout: 10_000 }).toBe(2);",
          '  expect(receiver.headers()[1]?.headers["x-github-event"]).toBe("issue_comment");',
          '  const body = JSON.parse(receiver.texts()[1]?.text ?? "{}");',
          '  expect([body.action, body.comment.user.login, body.comment.body, body.issue.number]).toEqual(["created", "reviewer", "@tester fix the typo", pr.number]);',
          '  expect(await github.conversation(pr)).toEqual([{ id: body.comment.id, user: "reviewer", body: "@tester fix the typo" }]);',
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

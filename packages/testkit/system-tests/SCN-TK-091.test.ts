import { type FakeGitHub, type FakeHttp, type PullRequest, scenario } from "@opensoftware/testkit";
import { githubClient } from "./github.ts";

scenario("SCN-TK-091", async ({ fakes, given, when, then }) => {
  let receiver: FakeHttp;
  let github: FakeGitHub;
  let pr: PullRequest;
  await given("fakes.http and a pull request in fakes.github", async () => {
    receiver = await fakes.http([{ method: "POST", path: "/github", body: {} }]);
    github = await fakes.github();
    await github.createRepository("demo");
    pr = await github.openPullRequest("demo", { branch: "fix", title: "Fix the typo", files: { "notes.md": "hi\n" } });
  });

  await when(
    'a module registers a webhook for "issue_comment" events to the URL of fakes.http through GitHub\'s API',
    async () => {
      await githubClient(github, { repository: "demo" })("POST", "/hooks", {
        name: "web",
        config: { url: `${receiver.url}/github`, content_type: "json", secret: "whsec-demo" },
        events: ["issue_comment"],
        active: true,
      });
    },
  );

  await when('"reviewer" says "@tester fix the typo" on the pull request in fakes.github', async () => {
    await github.say(pr, "@tester fix the typo");
  });

  await then('fakes.http gets an "issue_comment" delivery with that author and text', async () => {
    await expect.poll(() => receiver.headers().length, { timeout: 10_000 }).toBe(2);
    expect(receiver.headers()).toHaveLength(2);
    expect(receiver.headers()[1]?.headers["x-github-event"]).toBe("issue_comment");
    const body = JSON.parse(receiver.texts()[1]?.text ?? "{}");
    expect([body.action, body.comment.user.login, body.comment.body, body.issue.number]).toEqual([
      "created",
      "reviewer",
      "@tester fix the typo",
      pr.number,
    ]);
    expect(await github.conversation(pr)).toEqual([
      { id: body.comment.id, user: "reviewer", body: "@tester fix the typo" },
    ]);
  });
});

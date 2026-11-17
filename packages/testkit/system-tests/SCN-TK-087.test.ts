import { type FakeGitHub, type FakeHttp, scenario } from "@opensoftware/testkit";
import { githubClient } from "./github.ts";

scenario("SCN-TK-087", async ({ fakes, given, when, then }) => {
  let receiver: FakeHttp;
  let github: FakeGitHub;
  await given('fakes.http and the repository "demo" in fakes.github', async () => {
    receiver = await fakes.http([{ method: "POST", path: "/github", body: {} }]);
    github = await fakes.github();
    await github.createRepository("demo");
  });

  await when(
    'a module registers a webhook for "pull_request" events with a secret to the URL of fakes.http through GitHub\'s API',
    async () => {
      await githubClient(github, { repository: "demo" })("POST", "/hooks", {
        name: "web",
        config: { url: `${receiver.url}/github`, content_type: "json", secret: "whsec-demo" },
        events: ["pull_request"],
        active: true,
      });
    },
  );

  await when("the test opens a pull request in fakes.github", async () => {
    await github.openPullRequest("demo", { branch: "fix", title: "Fix the typo", files: { "notes.md": "hi\n" } });
  });

  await then('fakes.http gets a "ping" and a "pull_request" delivery, each with a "sha256=" signature', async () => {
    await expect.poll(() => receiver.headers().length, { timeout: 10_000 }).toBe(2);
    expect(receiver.headers()).toHaveLength(2);
    expect(receiver.headers().map((request) => request.headers["x-github-event"])).toEqual(["ping", "pull_request"]);
    for (const request of receiver.headers()) {
      expect(request.headers["x-hub-signature-256"]).toMatch(/^sha256=[0-9a-f]{64}$/);
    }
    expect(await github.hooks("demo")).toEqual([
      { url: `${receiver.url}/github`, events: ["pull_request"], active: true },
    ]);
  });
});

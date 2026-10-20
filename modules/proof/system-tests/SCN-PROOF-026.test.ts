import { type FakeHttp, scenario } from "@opensoftware/testkit";
import { githubRoutes } from "./forge.ts";
import { bundleOf, PR, SHA, screenshot } from "./reports.ts";

scenario("SCN-PROOF-026", async ({ sut, fakes, given, when, then }) => {
  let github: FakeHttp;
  await given('a GitHub API without comments on the pull request "https://github.com/acme/web/pull/7"', async () => {
    github = await fakes.http(githubRoutes([]));
  });

  await given('a bundle for that pull request where "SCN-WEB-001" passed', async () => {
    await bundleOf(sut, [{ title: "SCN-WEB-001 checkout", attachments: [screenshot("checkout.png")] }], {
      commit: SHA,
      pullRequest: PR,
    });
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when(
    'the developer runs "proof attach evidence" with PROOF_FORGE_URL of the GitHub API and PROOF_FORGE_TOKEN',
    async () => {
      run = await sut.cli(["attach", "evidence"], {
        env: { PROOF_FORGE_URL: github.url, PROOF_FORGE_TOKEN: "test-token" },
      });
    },
  );

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then(
    'the GitHub API received "POST /repos/acme/web/issues/7/comments" with a comment that lists "SCN-WEB-001"',
    async () => {
      const posted = github
        .received()
        .find((request) => request.method === "POST" && request.path.endsWith("/comments"));
      expect(posted?.path).toBe("/repos/acme/web/issues/7/comments");
      expect((posted?.body as { body?: string } | undefined)?.body).toContain("| SCN-WEB-001 | passed |");
    },
  );

  await then(
    'the GitHub API received "POST /repos/acme/web/statuses/9b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c" with the context "proof" and the state "success"',
    async () => {
      const status = github.received().find((request) => request.path === `/repos/acme/web/statuses/${SHA}`);
      expect(status?.body).toMatchObject({ context: "proof", state: "success" });
    },
  );
});

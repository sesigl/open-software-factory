import { type FakeHttp, scenario } from "@opensoftware/testkit";
import { githubRoutes } from "./forge.ts";
import { bundleOf, PR, SHA, screenshot } from "./reports.ts";

scenario("SCN-PROOF-027", async ({ sut, fakes, given, when, then }) => {
  let github: FakeHttp;
  await given(
    'a GitHub API with the proof comment 42 on the pull request "https://github.com/acme/web/pull/7"',
    async () => {
      github = await fakes.http(
        githubRoutes([
          { id: 41, body: "Looks good to me." },
          { id: 42, body: "<!-- proof -->\n### proof: failed" },
        ]),
      );
    },
  );

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

  await then('the GitHub API received "PATCH /repos/acme/web/issues/comments/42" and no new comment', async () => {
    expect(github.requests()).toContain("PATCH /repos/acme/web/issues/comments/42");
    expect(github.requests()).not.toContain("POST /repos/acme/web/issues/7/comments");
  });
});

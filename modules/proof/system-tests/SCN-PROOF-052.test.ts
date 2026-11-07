import { type FakeHttp, scenario } from "@opensoftware/testkit";
import { githubRoutes } from "./forge.ts";
import { bundleOf, manifestOf, PR, SHA, screenshot } from "./reports.ts";

scenario("SCN-PROOF-052", async ({ sut, fakes, given, when, then }) => {
  let github: FakeHttp;
  await given('a GitHub API without comments on the pull request "https://github.com/acme/web/pull/7"', async () => {
    github = await fakes.http(githubRoutes([]));
  });

  await given(
    'a bundle for that pull request where "SCN-WEB-001" passed, "SCN-WEB-002" failed with the screenshot "refund.png" and "SCN-WEB-003" was skipped with the screenshot "coupon.png"',
    async () => {
      await bundleOf(
        sut,
        [
          { title: "SCN-WEB-001 checkout", attachments: [screenshot("checkout.png")] },
          { title: "SCN-WEB-002 refund", status: "unexpected", attachments: [screenshot("refund.png")] },
          { title: "SCN-WEB-003 coupon", status: "skipped", attachments: [screenshot("coupon.png")] },
        ],
        { commit: SHA, pullRequest: PR },
      );
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when(
    'the developer runs "proof attach evidence --bundle-url https://ci.example.com/evidence" with PROOF_FORGE_URL of the GitHub API with a trailing slash and PROOF_FORGE_TOKEN "test-token"',
    async () => {
      run = await sut.cli(["attach", "evidence", "--bundle-url", "https://ci.example.com/evidence"], {
        env: { PROOF_FORGE_URL: `${github.url}/`, PROOF_FORGE_TOKEN: "test-token" },
      });
    },
  );

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then(
    `the output is 'added the comment on https://github.com/acme/web/pull/7; set "proof" to failure on 9b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c'`,
    async () => {
      expect(run.stdout.trim()).toBe(`added the comment on ${PR}; set "proof" to failure on ${SHA}`);
    },
  );

  await then(
    'the GitHub API received a comment with the marker, the title "### proof: failed", the counts, the commit, the bundle link and the rows of "SCN-WEB-002" and "SCN-WEB-003"',
    async () => {
      const { id } = await manifestOf(sut, "$INPUT/evidence");
      const posted = github
        .received()
        .find((request) => request.method === "POST" && request.path.endsWith("/comments"));
      expect((posted?.body as { body?: string } | undefined)?.body).toBe(
        [
          "<!-- proof -->",
          "### proof: failed",
          "",
          `Scenarios: 1 passed, 1 failed, 1 skipped. Commit ${SHA}. Evidence bundle: [${id}](https://ci.example.com/evidence)`,
          "",
          "| Scenario | Result | Evidence |",
          "| --- | --- | --- |",
          "| SCN-WEB-002 | failed | `refund.png` |",
          "| SCN-WEB-003 | skipped | `coupon.png` |",
          "",
        ].join("\n"),
      );
    },
  );

  await then(
    'the GitHub API received the status with the context "proof", the state "failure", the description "1 of 3 scenarios passed" and the target URL "https://ci.example.com/evidence"',
    async () => {
      const status = github.received().find((request) => request.path === `/repos/acme/web/statuses/${SHA}`);
      expect(status?.body).toEqual({
        context: "proof",
        state: "failure",
        description: "1 of 3 scenarios passed",
        target_url: "https://ci.example.com/evidence",
      });
    },
  );

  await then(
    'each request to the GitHub API has the header "authorization" with the value "token test-token"',
    async () => {
      const requests = github.headers();
      expect(requests.map((request) => request.path)).toEqual([
        "/repos/acme/web/issues/7/comments?per_page=100&page=1",
        "/repos/acme/web/issues/7/comments",
        `/repos/acme/web/statuses/${SHA}`,
      ]);
      for (const request of requests) expect(request.headers.authorization).toBe("token test-token");
    },
  );
});

import { type FakeHttp, scenario } from "@opensoftware/testkit";
import { bundleOf, PR, SHA } from "./reports.ts";

scenario("SCN-PROOF-030", async ({ sut, fakes, given, when, then }) => {
  let github: FakeHttp;
  await given(
    'a GitHub API that answers 403 to the comments of the pull request "https://github.com/acme/web/pull/7"',
    async () => {
      github = await fakes.http([
        {
          path: "/repos/acme/web/issues/7/comments?per_page=100&page=1",
          status: 403,
          body: { message: "Resource not accessible by integration" },
        },
      ]);
    },
  );

  await given('a bundle for that pull request where "SCN-WEB-001" passed', async () => {
    await bundleOf(sut, [{ title: "SCN-WEB-001 checkout" }], { commit: SHA, pullRequest: PR });
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

  await then("the command exits with code 1", async () => {
    expect(run.exitCode).toBe(1);
  });

  await then(
    'the error output contains "the forge answered 403 to GET /repos/acme/web/issues/7/comments"',
    async () => {
      expect(run.stderr).toContain("the forge answered 403 to GET /repos/acme/web/issues/7/comments");
    },
  );
});

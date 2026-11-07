import { type FakeHttp, scenario } from "@opensoftware/testkit";
import { githubRoutes } from "./forge.ts";
import { bundleOf, manifestOf, PR, SHA, screenshot } from "./reports.ts";

scenario("SCN-PROOF-053", async ({ sut, fakes, given, when, then }) => {
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
    'the GitHub API received a comment with the marker, the title "### proof: passed", the counts, the commit and "<bundle id> (not uploaded)", and no table',
    async () => {
      const { id } = await manifestOf(sut, "$INPUT/evidence");
      const posted = github
        .received()
        .find((request) => request.method === "POST" && request.path.endsWith("/comments"));
      expect((posted?.body as { body?: string } | undefined)?.body).toBe(
        [
          "<!-- proof -->",
          "### proof: passed",
          "",
          `Scenarios: 1 passed, 0 failed, 0 skipped. Commit ${SHA}. Evidence bundle: ${id} (not uploaded)`,
          "",
        ].join("\n"),
      );
    },
  );
});

import { scenario } from "@opensoftware/testkit";
import { manifestOf, PR, putPlaywright } from "./reports.ts";

scenario("SCN-PROOF-013", async ({ sut, given, when, then }) => {
  let head = "";
  await given('a Git repository with one commit and a Playwright report for "SCN-WEB-001"', async () => {
    await putPlaywright(sut, [{ title: "SCN-WEB-001 checkout" }]);
    head = await sut.git.commit("init");
  });

  await when(
    'the developer runs "proof bundle --playwright report.json --repository https://github.com/acme/web --pull-request https://github.com/acme/web/pull/7"',
    async () => {
      const run = await sut.cli([
        "bundle",
        "--playwright",
        "report.json",
        "--repository",
        "https://github.com/acme/web",
        "--pull-request",
        PR,
      ]);
      expect(run.exitCode, run.stderr).toBe(0);
    },
  );

  await then(
    `the bundle's subject has the commit of the repository, the repository "https://github.com/acme/web" and the pull request "https://github.com/acme/web/pull/7"`,
    async () => {
      expect((await manifestOf(sut)).subject).toEqual({
        repository: "https://github.com/acme/web",
        commit: head,
        pullRequest: PR,
      });
    },
  );

  await then('the bundle has the producer "proof" and the creation time "2026-01-01T00:00:00Z"', async () => {
    const manifest = await manifestOf(sut);
    expect(manifest.producer.name).toBe("proof");
    expect(manifest.createdAt).toBe("2026-01-01T00:00:00Z");
  });
});

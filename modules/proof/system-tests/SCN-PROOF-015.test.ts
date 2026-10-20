import { scenario } from "@opensoftware/testkit";
import { manifestOf, putPlaywright } from "./reports.ts";

scenario("SCN-PROOF-015", async ({ sut, given, when, then }) => {
  await given('a Git repository with one commit and a Playwright report for "SCN-WEB-001"', async () => {
    await putPlaywright(sut, [{ title: "SCN-WEB-001 checkout" }]);
    await sut.git.commit("init");
  });

  await when(
    'the developer runs "proof bundle --playwright report.json" with GITHUB_SERVER_URL "https://github.com" and GITHUB_REPOSITORY "acme/web"',
    async () => {
      const run = await sut.cli(["bundle", "--playwright", "report.json"], {
        env: { GITHUB_SERVER_URL: "https://github.com", GITHUB_REPOSITORY: "acme/web" },
      });
      expect(run.exitCode, run.stderr).toBe(0);
    },
  );

  await then(`the bundle's subject has the repository "https://github.com/acme/web"`, async () => {
    expect((await manifestOf(sut)).subject.repository).toBe("https://github.com/acme/web");
  });
});

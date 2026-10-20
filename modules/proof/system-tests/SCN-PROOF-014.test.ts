import { scenario } from "@opensoftware/testkit";
import { manifestOf, putPlaywright, SHA } from "./reports.ts";

scenario("SCN-PROOF-014", async ({ sut, given, when, then }) => {
  await given('a Git repository with one commit and a Playwright report for "SCN-WEB-001"', async () => {
    await putPlaywright(sut, [{ title: "SCN-WEB-001 checkout" }]);
    await sut.git.commit("init");
  });

  await when(
    'the developer runs "proof bundle --playwright report.json --repository https://github.com/acme/web --commit 9b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c"',
    async () => {
      const run = await sut.cli([
        "bundle",
        "--playwright",
        "report.json",
        "--repository",
        "https://github.com/acme/web",
        "--commit",
        SHA,
      ]);
      expect(run.exitCode, run.stderr).toBe(0);
    },
  );

  await then(`the bundle's subject has the commit "9b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c"`, async () => {
    expect((await manifestOf(sut)).subject.commit).toBe(SHA);
  });
});

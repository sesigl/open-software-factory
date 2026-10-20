import { scenario } from "@opensoftware/testkit";
import { manifestOf, putPlaywright } from "./reports.ts";

scenario("SCN-PROOF-017", async ({ sut, given, when, then }) => {
  await given('a Git repository with one commit and a Playwright report for "SCN-WEB-001"', async () => {
    await putPlaywright(sut, [{ title: "SCN-WEB-001 checkout" }]);
    await sut.git.commit("init");
  });

  const ids: string[] = [];
  await when(
    'the developer runs "proof bundle --playwright report.json --repository https://github.com/acme/web" twice',
    async () => {
      for (const _ of [1, 2]) {
        const run = await sut.cli([
          "bundle",
          "--playwright",
          "report.json",
          "--repository",
          "https://github.com/acme/web",
        ]);
        expect(run.exitCode, run.stderr).toBe(0);
        ids.push((await manifestOf(sut)).id);
      }
    },
  );

  await then("both bundles have the same ID", async () => {
    expect(ids[0]).toMatch(/^proof-[0-9a-f]{26}$/);
    expect((await manifestOf(sut)).id).toBe(ids[0]);
  });
});

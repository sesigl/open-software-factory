import { scenario } from "@opensoftware/testkit";
import { manifestOf, putPlaywright } from "./reports.ts";

scenario("SCN-PROOF-007", async ({ sut, given, when, then }) => {
  await given('a Playwright report where the test of "SCN-WEB-001" has the status "skipped"', async () => {
    await putPlaywright(sut, [{ title: "SCN-WEB-001 a guest pays with a card", status: "skipped" }]);
    await sut.git.commit("init");
  });

  await when('the developer runs "proof bundle --playwright report.json"', async () => {
    const run = await sut.cli(["bundle", "--playwright", "report.json", "--repository", "https://github.com/acme/web"]);
    expect(run.exitCode, run.stderr).toBe(0);
  });

  await then('the bundle lists the scenario "SCN-WEB-001" with the result "skipped"', async () => {
    expect((await manifestOf(sut)).scenarios).toEqual([
      expect.objectContaining({ id: "SCN-WEB-001", result: "skipped" }),
    ]);
  });

  await then('the bundle has the result "failed"', async () => {
    expect((await manifestOf(sut)).result).toBe("failed");
  });
});

import { scenario } from "@opensoftware/testkit";
import { manifestOf, putPlaywright } from "./reports.ts";

scenario("SCN-PROOF-006", async ({ sut, given, when, then }) => {
  await given('a Playwright report where the test of "SCN-WEB-001" has the status "flaky"', async () => {
    await putPlaywright(sut, [{ title: "SCN-WEB-001 a guest pays with a card", status: "flaky" }]);
    await sut.git.commit("init");
  });

  await when('the developer runs "proof bundle --playwright report.json"', async () => {
    const run = await sut.cli(["bundle", "--playwright", "report.json", "--repository", "https://github.com/acme/web"]);
    expect(run.exitCode, run.stderr).toBe(0);
  });

  await then('the bundle lists the scenario "SCN-WEB-001" with the result "failed"', async () => {
    expect((await manifestOf(sut)).scenarios).toEqual([
      expect.objectContaining({ id: "SCN-WEB-001", result: "failed" }),
    ]);
  });
});

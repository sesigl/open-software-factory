import { scenario } from "@opensoftware/testkit";
import { manifestOf, putPlaywright } from "./reports.ts";

scenario("SCN-PROOF-008", async ({ sut, given, when, then }) => {
  await given('a Playwright report with the tests "SCN-WEB-001 checkout" and "loads the home page"', async () => {
    await putPlaywright(sut, [{ title: "SCN-WEB-001 checkout" }, { title: "loads the home page" }]);
    await sut.git.commit("init");
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "proof bundle --playwright report.json"', async () => {
    run = await sut.cli(["bundle", "--playwright", "report.json", "--repository", "https://github.com/acme/web"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stderr).toBe(0);
  });

  await then('the error output contains "no scenario ID: loads the home page"', async () => {
    expect(run.stderr).toContain("no scenario ID: loads the home page");
  });

  await then('the bundle lists only the scenario "SCN-WEB-001"', async () => {
    expect((await manifestOf(sut)).scenarios.map((entry) => entry.id)).toEqual(["SCN-WEB-001"]);
  });
});

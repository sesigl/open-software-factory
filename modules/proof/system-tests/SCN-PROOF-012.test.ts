import { scenario } from "@opensoftware/testkit";
import { junitReport, manifestOf, putPlaywright, screenshot } from "./reports.ts";

scenario("SCN-PROOF-012", async ({ sut, given, when, then }) => {
  await given('a Playwright report whose test "SCN-WEB-001 checkout" has the screenshot "checkout.png"', async () => {
    await putPlaywright(sut, [{ title: "SCN-WEB-001 checkout", attachments: [screenshot("checkout.png")] }]);
  });

  await given('a JUnit report with a passed test case that has the property "scenario" "SCN-WEB-001"', async () => {
    await sut.files.put("$INPUT/report.xml", junitReport([{ name: "checkout", scenario: "SCN-WEB-001" }]));
    await sut.git.commit("init");
  });

  await when('the developer runs "proof bundle --playwright report.json --junit report.xml"', async () => {
    const run = await sut.cli([
      "bundle",
      "--playwright",
      "report.json",
      "--junit",
      "report.xml",
      "--repository",
      "https://github.com/acme/web",
    ]);
    expect(run.exitCode, run.stderr).toBe(0);
  });

  await then(
    'the bundle lists the scenario "SCN-WEB-001" once, with the artifacts "artifacts/SCN-WEB-001/checkout.png" and "junit/report.xml"',
    async () => {
      expect((await manifestOf(sut)).scenarios).toEqual([
        { id: "SCN-WEB-001", result: "passed", artifacts: ["artifacts/SCN-WEB-001/checkout.png", "junit/report.xml"] },
      ]);
    },
  );
});

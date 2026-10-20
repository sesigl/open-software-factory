import { scenario } from "@opensoftware/testkit";
import { junitReport, manifestOf } from "./reports.ts";

scenario("SCN-PROOF-011", async ({ sut, given, when, then }) => {
  await given(
    'a JUnit report with the test case "SCN-API-003 creates an order" and a skipped test case "SCN-API-004 deletes an order"',
    async () => {
      await sut.files.put(
        "$INPUT/report.xml",
        junitReport([
          { name: "SCN-API-003 creates an order" },
          { name: "SCN-API-004 deletes an order", result: "skipped" },
        ]),
      );
      await sut.git.commit("init");
    },
  );

  await when('the developer runs "proof bundle --junit report.xml"', async () => {
    const run = await sut.cli(["bundle", "--junit", "report.xml", "--repository", "https://github.com/acme/web"]);
    expect(run.exitCode, run.stderr).toBe(0);
  });

  await then('the bundle lists the scenario "SCN-API-003" with the result "passed"', async () => {
    expect((await manifestOf(sut)).scenarios).toContainEqual(
      expect.objectContaining({ id: "SCN-API-003", result: "passed" }),
    );
  });

  await then('the bundle lists the scenario "SCN-API-004" with the result "skipped"', async () => {
    expect((await manifestOf(sut)).scenarios).toContainEqual(
      expect.objectContaining({ id: "SCN-API-004", result: "skipped" }),
    );
  });
});

import { scenario } from "@opensoftware/testkit";
import { manifestOf, putPlaywright } from "./reports.ts";

scenario("SCN-PROOF-003", async ({ sut, given, when, then }) => {
  await given(
    'a Playwright report with the scenario ID "SCN-WEB-001" in a title, "SCN-WEB-002" in a tag and "SCN-WEB-003" in an annotation',
    async () => {
      await putPlaywright(sut, [
        { title: "SCN-WEB-001 a guest pays with a card" },
        { title: "a guest pays with a voucher", tags: ["@SCN-WEB-002"] },
        { title: "a member pays later", annotations: [{ type: "scenario", description: "SCN-WEB-003" }] },
      ]);
      await sut.git.commit("init");
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "proof bundle --playwright report.json"', async () => {
    run = await sut.cli(["bundle", "--playwright", "report.json", "--repository", "https://github.com/acme/web"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stderr).toBe(0);
  });

  await then(
    'the bundle lists the scenarios "SCN-WEB-001", "SCN-WEB-002" and "SCN-WEB-003" with the result "passed"',
    async () => {
      const manifest = await manifestOf(sut);
      expect(manifest.scenarios.map(({ id, result }) => ({ id, result }))).toEqual([
        { id: "SCN-WEB-001", result: "passed" },
        { id: "SCN-WEB-002", result: "passed" },
        { id: "SCN-WEB-003", result: "passed" },
      ]);
    },
  );
});

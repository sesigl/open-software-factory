import { scenario } from "@opensoftware/testkit";
import { bundleOf, screenshot } from "./reports.ts";

scenario("SCN-PROOF-019", async ({ sut, given, when, then }) => {
  await given('a bundle where "SCN-WEB-001" passed with a screenshot', async () => {
    await bundleOf(sut, [{ title: "SCN-WEB-001 checkout", attachments: [screenshot("checkout.png")] }]);
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "proof verify evidence --scenario SCN-WEB-001 --scenario SCN-WEB-009"', async () => {
    run = await sut.cli(["verify", "evidence", "--scenario", "SCN-WEB-001", "--scenario", "SCN-WEB-009"]);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode).toBe(1);
  });

  await then('the output contains "SCN-WEB-009 has no evidence"', async () => {
    expect(run.stdout).toContain("SCN-WEB-009 has no evidence");
  });
});

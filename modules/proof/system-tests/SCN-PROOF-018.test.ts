import { scenario } from "@opensoftware/testkit";
import { bundleOf, screenshot } from "./reports.ts";

scenario("SCN-PROOF-018", async ({ sut, given, when, then }) => {
  await given('a bundle where "SCN-WEB-001" passed with a screenshot', async () => {
    await bundleOf(sut, [{ title: "SCN-WEB-001 checkout", attachments: [screenshot("checkout.png")] }]);
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "proof verify evidence --scenario SCN-WEB-001"', async () => {
    run = await sut.cli(["verify", "evidence", "--scenario", "SCN-WEB-001"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then('the output contains "SCN-WEB-001 passed with 1 artifact"', async () => {
    expect(run.stdout).toContain("SCN-WEB-001 passed with 1 artifact");
  });
});

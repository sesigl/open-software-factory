import { scenario } from "@opensoftware/testkit";
import { bundleOf, screenshot } from "./reports.ts";

scenario("SCN-PROOF-020", async ({ sut, given, when, then }) => {
  await given('a bundle where "SCN-WEB-001" passed and "SCN-WEB-002" failed', async () => {
    await bundleOf(sut, [
      { title: "SCN-WEB-001 checkout", attachments: [screenshot("checkout.png")] },
      { title: "SCN-WEB-002 refund", status: "unexpected", attachments: [screenshot("refund.png")] },
    ]);
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "proof verify evidence"', async () => {
    run = await sut.cli(["verify", "evidence"]);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode).toBe(1);
  });

  await then('the output contains "SCN-WEB-002 failed"', async () => {
    expect(run.stdout).toContain("SCN-WEB-002 failed");
  });
});

import { scenario } from "@opensoftware/testkit";
import { bundleOf, screenshot } from "./reports.ts";

scenario("SCN-PROOF-050", async ({ sut, given, when, then }) => {
  await given(
    'a bundle where "SCN-WEB-001" passed with 2 screenshots, "SCN-WEB-002" passed without a file and "SCN-WEB-003" was skipped with a screenshot',
    async () => {
      await bundleOf(sut, [
        { title: "SCN-WEB-001 checkout", attachments: [screenshot("checkout.png"), screenshot("receipt.png")] },
        { title: "SCN-WEB-002 refund" },
        { title: "SCN-WEB-003 coupon", status: "skipped", attachments: [screenshot("coupon.png")] },
      ]);
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "proof verify evidence"', async () => {
    run = await sut.cli(["verify", "evidence"]);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then(
    'the output is the lines "SCN-WEB-001 passed with 2 artifacts", "SCN-WEB-002 has no evidence" and "SCN-WEB-003 was skipped"',
    async () => {
      expect(run.stdout.trim().split("\n")).toEqual([
        "SCN-WEB-001 passed with 2 artifacts",
        "SCN-WEB-002 has no evidence",
        "SCN-WEB-003 was skipped",
      ]);
    },
  );
});

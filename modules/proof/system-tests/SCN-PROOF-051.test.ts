import { scenario } from "@opensoftware/testkit";
import { bundleOf, screenshot } from "./reports.ts";

scenario("SCN-PROOF-051", async ({ sut, given, when, then }) => {
  await given('a bundle where "SCN-WEB-001" passed with a screenshot', async () => {
    await bundleOf(sut, [{ title: "SCN-WEB-001 checkout", attachments: [screenshot("checkout.png")] }]);
  });

  await given("the screenshot was removed after the bundle was written", async () => {
    await sut.files.remove("$INPUT/evidence/artifacts/SCN-WEB-001/checkout.png");
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "proof verify evidence"', async () => {
    run = await sut.cli(["verify", "evidence"]);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then('the output contains "artifacts/SCN-WEB-001/checkout.png is missing"', async () => {
    expect(run.stdout).toContain("artifacts/SCN-WEB-001/checkout.png is missing");
  });
});

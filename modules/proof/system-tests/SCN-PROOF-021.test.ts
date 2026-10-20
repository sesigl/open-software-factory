import { scenario } from "@opensoftware/testkit";
import { bundleOf, screenshot } from "./reports.ts";

scenario("SCN-PROOF-021", async ({ sut, given, when, then }) => {
  await given('a bundle where "SCN-WEB-001" passed with a screenshot', async () => {
    await bundleOf(sut, [{ title: "SCN-WEB-001 checkout", attachments: [screenshot("checkout.png")] }]);
  });

  await given("the screenshot was changed after the bundle was written", async () => {
    await sut.files.put("$INPUT/evidence/artifacts/SCN-WEB-001/checkout.png", "another picture");
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "proof verify evidence"', async () => {
    run = await sut.cli(["verify", "evidence"]);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode).toBe(1);
  });

  await then('the output contains "artifacts/SCN-WEB-001/checkout.png does not match its SHA-256"', async () => {
    expect(run.stdout).toContain("artifacts/SCN-WEB-001/checkout.png does not match its SHA-256");
  });
});

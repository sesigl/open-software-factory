import { scenario } from "@opensoftware/testkit";
import { block, feature, put, readReport, test } from "./repo.ts";

scenario("SCN-TRACE-043", async ({ sut, given, when, then }) => {
  await given(
    'a repository with the implemented scenario "SCN-SHOP-001" and its test and the planned scenario "SCN-SHOP-002" without one',
    async () => {
      await put(sut, {
        "features/checkout.feature": feature(
          block("@id=SCN-SHOP-001 @status=implemented"),
          block("@id=SCN-SHOP-002 @status=planned"),
        ),
        "tests/SCN-SHOP-001.test.ts": test("SCN-SHOP-001"),
      });
    },
  );

  await given('a proof bundle in "evidence" with two artifacts for "SCN-SHOP-001"', async () => {
    const artifact = (path: string, kind: string, mediaType: string) => ({
      path,
      kind,
      mediaType,
      sha256: "0".repeat(64),
    });
    const manifest = {
      manifestVersion: 1,
      id: "01JABCDEVID0000000000000001",
      createdAt: "2026-01-01T00:00:00Z",
      subject: { repository: "https://github.com/acme/shop", commit: "9b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c" },
      producer: { name: "proof", version: "0.1.0" },
      result: "passed",
      scenarios: [{ id: "SCN-SHOP-001", result: "passed", artifacts: ["shot.png", "trace.zip"] }],
      artifacts: [
        artifact("shot.png", "screenshot", "image/png"),
        artifact("trace.zip", "playwright-trace", "application/zip"),
      ],
    };
    await sut.files.put("$INPUT/evidence/evidence.json", JSON.stringify(manifest));
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "spec-trace report --evidence evidence"', async () => {
    run = await sut.cli(["report", "--evidence", "evidence"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then('the report lists "SCN-SHOP-001" with the evidence 2 and "SCN-SHOP-002" with the evidence 0', async () => {
    const report = await readReport(sut);
    expect(report.scenarios).toMatchObject([
      { id: "SCN-SHOP-001", evidence: 2 },
      { id: "SCN-SHOP-002", evidence: 0 },
    ]);
  });
});

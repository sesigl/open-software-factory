import { scenario } from "@opensoftware/testkit";
import { block, feature, put } from "./repo.ts";

scenario("SCN-TRACE-056", async ({ sut, given, when, then }) => {
  await given('a repository with the implemented scenario "SCN-SHOP-001" and no test', async () => {
    await put(sut, { "features/checkout.feature": feature(block("@id=SCN-SHOP-001 @status=implemented")) });
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "spec-trace report --summary summary.md"', async () => {
    run = await sut.cli(["report", "--summary", "summary.md"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then(
    'the file "summary.md" in the working folder contains "1 scenarios: 1 implemented, 0 planned, 0 deprecated; 0 with a test, 0 passed"',
    async () => {
      expect(await sut.files.read("$INPUT/summary.md")).toContain(
        "1 scenarios: 1 implemented, 0 planned, 0 deprecated; 0 with a test, 0 passed",
      );
    },
  );

  await then(
    'the file "summary.md" in the working folder contains "| TRACE | features/checkout.feature:4 | SCN-SHOP-001 is implemented but has no system test |"',
    async () => {
      expect(await sut.files.read("$INPUT/summary.md")).toContain(
        "| TRACE | features/checkout.feature:4 | SCN-SHOP-001 is implemented but has no system test |",
      );
    },
  );
});

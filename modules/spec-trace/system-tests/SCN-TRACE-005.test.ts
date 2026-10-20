import { scenario } from "@opensoftware/testkit";
import { block, feature, put } from "./repo.ts";

scenario("SCN-TRACE-005", async ({ sut, given, when, then }) => {
  await given('a repository with the scenario "SCN-SHOP-001" tagged "@status=done"', async () => {
    await put(sut, { "features/checkout.feature": feature(block("@id=SCN-SHOP-001 @status=done")) });
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "spec-trace check --only SPEC"', async () => {
    run = await sut.cli(["check", "--only", "SPEC"]);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then(
    'the output contains "SPEC features/checkout.feature:4 @status=done is not one of planned, implemented, deprecated"',
    async () => {
      expect(run.stdout).toContain(
        "SPEC features/checkout.feature:4 @status=done is not one of planned, implemented, deprecated",
      );
    },
  );
});

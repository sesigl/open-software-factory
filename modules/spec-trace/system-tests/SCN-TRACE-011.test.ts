import { scenario } from "@opensoftware/testkit";
import { block, feature, put } from "./repo.ts";

scenario("SCN-TRACE-011", async ({ sut, given, when, then }) => {
  await given('a repository with the implemented scenario "SCN-SHOP-001" and no test', async () => {
    await put(sut, { "features/checkout.feature": feature(block("@id=SCN-SHOP-001 @status=implemented")) });
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "spec-trace check --only TRACE"', async () => {
    run = await sut.cli(["check", "--only", "TRACE"]);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then(
    'the output contains "TRACE features/checkout.feature:4 SCN-SHOP-001 is implemented but has no system test"',
    async () => {
      expect(run.stdout).toContain(
        "TRACE features/checkout.feature:4 SCN-SHOP-001 is implemented but has no system test",
      );
    },
  );
});

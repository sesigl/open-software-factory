import { scenario } from "@opensoftware/testkit";
import { block, feature, put } from "./repo.ts";

scenario("SCN-TRACE-003", async ({ sut, given, when, then }) => {
  await given('a repository with two scenarios with the ID "SCN-SHOP-001"', async () => {
    const tags = "@id=SCN-SHOP-001 @status=planned";
    await put(sut, { "features/checkout.feature": feature(block(tags), block(tags)) });
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "spec-trace check --only SPEC"', async () => {
    run = await sut.cli(["check", "--only", "SPEC"]);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then(
    'the output contains "SPEC features/checkout.feature:10 duplicate ID SCN-SHOP-001, first at features/checkout.feature:4"',
    async () => {
      expect(run.stdout).toContain(
        "SPEC features/checkout.feature:10 duplicate ID SCN-SHOP-001, first at features/checkout.feature:4",
      );
    },
  );
});

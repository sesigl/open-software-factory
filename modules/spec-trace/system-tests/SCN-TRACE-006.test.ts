import { scenario } from "@opensoftware/testkit";
import { block, feature, put } from "./repo.ts";

scenario("SCN-TRACE-006", async ({ sut, given, when, then }) => {
  await given('a repository with the scenario ID "SHOP-1"', async () => {
    await put(sut, { "features/checkout.feature": feature(block("@id=SHOP-1 @status=planned")) });
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "spec-trace check --only SPEC"', async () => {
    run = await sut.cli(["check", "--only", "SPEC"]);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then(
    'the output contains "SPEC features/checkout.feature:4 ID SHOP-1 does not match ^SCN-([A-Z][A-Z0-9]*)-\\d{3}$"',
    async () => {
      expect(run.stdout).toContain(
        "SPEC features/checkout.feature:4 ID SHOP-1 does not match ^SCN-([A-Z][A-Z0-9]*)-\\d{3}$",
      );
    },
  );
});

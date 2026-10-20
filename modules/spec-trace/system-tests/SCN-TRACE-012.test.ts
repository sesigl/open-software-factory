import { scenario } from "@opensoftware/testkit";
import { block, feature, put, test } from "./repo.ts";

scenario("SCN-TRACE-012", async ({ sut, given, when, then }) => {
  await given(
    'a repository with the implemented scenario "SCN-SHOP-001" and the tests "tests/a.test.ts" and "tests/b.test.ts"',
    async () => {
      await put(sut, {
        "features/checkout.feature": feature(block("@id=SCN-SHOP-001 @status=implemented")),
        "tests/a.test.ts": test("SCN-SHOP-001"),
        "tests/b.test.ts": test("SCN-SHOP-001"),
      });
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "spec-trace check --only TRACE"', async () => {
    run = await sut.cli(["check", "--only", "TRACE"]);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then(
    'the output contains "TRACE features/checkout.feature:4 SCN-SHOP-001 has 2 system tests: tests/a.test.ts:3, tests/b.test.ts:3"',
    async () => {
      expect(run.stdout).toContain(
        "TRACE features/checkout.feature:4 SCN-SHOP-001 has 2 system tests: tests/a.test.ts:3, tests/b.test.ts:3",
      );
    },
  );
});

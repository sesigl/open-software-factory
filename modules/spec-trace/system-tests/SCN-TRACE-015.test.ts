import { scenario } from "@opensoftware/testkit";
import { block, feature, put, test } from "./repo.ts";

scenario("SCN-TRACE-015", async ({ sut, given, when, then }) => {
  await given("a repository with a test that passes the scenario ID in a variable", async () => {
    const code = test("SCN-SHOP-001").replace('scenario("SCN-SHOP-001"', 'const id = "SCN-SHOP-001";\nscenario(id');
    await put(sut, {
      "features/checkout.feature": feature(block("@id=SCN-SHOP-001 @status=planned")),
      "tests/SCN-SHOP-001.test.ts": code,
    });
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "spec-trace check --only TRACE"', async () => {
    run = await sut.cli(["check", "--only", "TRACE"]);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then(
    'the output contains "TRACE tests/SCN-SHOP-001.test.ts:4 the scenario ID must be a string literal"',
    async () => {
      expect(run.stdout).toContain("TRACE tests/SCN-SHOP-001.test.ts:4 the scenario ID must be a string literal");
    },
  );
});

import { scenario } from "@opensoftware/testkit";
import { LABELS, put, test, traced } from "./repo.ts";

scenario("SCN-TRACE-021", async ({ sut, given, when, then }) => {
  await given('a repository with the implemented scenario "SCN-SHOP-001" and its test', async () => {
    await traced(sut);
  });

  await given('the test has no step for "Then the order is paid"', async () => {
    await put(sut, { "tests/SCN-SHOP-001.test.ts": test("SCN-SHOP-001", LABELS.slice(0, 2)) });
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "spec-trace check --only STEPS"', async () => {
    run = await sut.cli(["check", "--only", "STEPS"]);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then(
    "the output contains 'STEPS tests/SCN-SHOP-001.test.ts:3 missing the step \"Then the order is paid\" of features/checkout.feature:4'",
    async () => {
      expect(run.stdout).toContain(
        'STEPS tests/SCN-SHOP-001.test.ts:3 missing the step "Then the order is paid" of features/checkout.feature:4',
      );
    },
  );
});

import { scenario } from "@opensoftware/testkit";
import { LABELS, put, test, traced } from "./repo.ts";

scenario("SCN-TRACE-020", async ({ sut, given, when, then }) => {
  await given('a repository with the implemented scenario "SCN-SHOP-001" and its test', async () => {
    await traced(sut);
  });

  await given('the test labels the step "When the guest pays with a card" as "the guest pays"', async () => {
    const labels = LABELS.map(([step, label]): [string, string] => [step, step === "when" ? "the guest pays" : label]);
    await put(sut, { "tests/SCN-SHOP-001.test.ts": test("SCN-SHOP-001", labels) });
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "spec-trace check --only STEPS"', async () => {
    run = await sut.cli(["check", "--only", "STEPS"]);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then(
    'the output contains \'STEPS tests/SCN-SHOP-001.test.ts:5 when("the guest pays") differs from the step "When the guest pays with a card" (features/checkout.feature:6)\'',
    async () => {
      expect(run.stdout).toContain(
        'STEPS tests/SCN-SHOP-001.test.ts:5 when("the guest pays") differs from the step "When the guest pays with a card" (features/checkout.feature:6)',
      );
    },
  );
});

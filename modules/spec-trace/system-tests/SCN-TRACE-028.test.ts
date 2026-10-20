import { scenario } from "@opensoftware/testkit";
import { traced } from "./repo.ts";

scenario("SCN-TRACE-028", async ({ sut, given, when, then }) => {
  await given('a repository with the implemented scenario "SCN-SHOP-001" and its test', async () => {
    await traced(sut);
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "spec-trace check --only PASS"', async () => {
    run = await sut.cli(["check", "--only", "PASS"]);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then(
    'the output contains "PASS features/checkout.feature:4 no JUnit results in reports/junit: run the tests first"',
    async () => {
      expect(run.stdout).toContain(
        "PASS features/checkout.feature:4 no JUnit results in reports/junit: run the tests first",
      );
    },
  );
});

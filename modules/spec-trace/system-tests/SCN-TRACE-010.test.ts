import { scenario } from "@opensoftware/testkit";

scenario("SCN-TRACE-010", async ({ sut, given, when, then }) => {
  await given('a repository with a feature file that ends after the tag line "@id=SCN-SHOP-001"', async () => {
    await sut.files.put("$INPUT/features/checkout.feature", "Feature: Checkout\n  @id=SCN-SHOP-001\n");
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "spec-trace check --only SPEC"', async () => {
    run = await sut.cli(["check", "--only", "SPEC"]);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then('the output contains "SPEC features/checkout.feature:3 Gherkin does not parse"', async () => {
    expect(run.stdout).toContain("SPEC features/checkout.feature:3 Gherkin does not parse");
  });
});

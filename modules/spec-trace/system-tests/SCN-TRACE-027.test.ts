import { scenario } from "@opensoftware/testkit";
import { junit, traced } from "./repo.ts";

scenario("SCN-TRACE-027", async ({ sut, given, when, then }) => {
  await given('a repository with the implemented scenario "SCN-SHOP-001" and its test', async () => {
    await traced(sut);
  });

  await given('a JUnit report without a test of "SCN-SHOP-001"', async () => {
    await sut.files.put("$INPUT/reports/junit/checkout.xml", junit([{ id: "SCN-SHOP-002" }]));
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "spec-trace check --only PASS"', async () => {
    run = await sut.cli(["check", "--only", "PASS"]);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then(
    'the output contains "PASS features/checkout.feature:4 SCN-SHOP-001 did not run in this run"',
    async () => {
      expect(run.stdout).toContain("PASS features/checkout.feature:4 SCN-SHOP-001 did not run in this run");
    },
  );
});

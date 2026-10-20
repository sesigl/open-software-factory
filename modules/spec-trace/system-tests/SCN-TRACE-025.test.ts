import { scenario } from "@opensoftware/testkit";
import { junit, traced } from "./repo.ts";

scenario("SCN-TRACE-025", async ({ sut, given, when, then }) => {
  await given('a repository with the implemented scenario "SCN-SHOP-001" and its test', async () => {
    await traced(sut);
  });

  await given('a JUnit report in which the test of "SCN-SHOP-001" was skipped', async () => {
    await sut.files.put("$INPUT/reports/junit/checkout.xml", junit([{ id: "SCN-SHOP-001", body: "<skipped/>" }]));
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "spec-trace check --only PASS"', async () => {
    run = await sut.cli(["check", "--only", "PASS"]);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then('the output contains "PASS features/checkout.feature:4 SCN-SHOP-001 was skipped"', async () => {
    expect(run.stdout).toContain("PASS features/checkout.feature:4 SCN-SHOP-001 was skipped");
  });
});

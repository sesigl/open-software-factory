import { scenario } from "@opensoftware/testkit";
import { junit, traced } from "./repo.ts";

scenario("SCN-TRACE-029", async ({ sut, given, when, then }) => {
  await given('a repository with the implemented scenario "SCN-SHOP-001" and its test', async () => {
    await traced(sut);
  });

  await given(
    'a JUnit report with the passed test case "SCN-SHOP-001 a guest pays" without a scenario property',
    async () => {
      await sut.files.put("$INPUT/reports/junit/checkout.xml", junit([{ name: "SCN-SHOP-001 a guest pays" }]));
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "spec-trace check --only PASS"', async () => {
    run = await sut.cli(["check", "--only", "PASS"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then('the output contains "PASS ok"', async () => {
    expect(run.stdout).toContain("PASS ok");
  });
});

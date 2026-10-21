import { scenario } from "@opensoftware/testkit";
import { demoBase } from "./mutation.ts";
import { mutationReport } from "./repo.ts";

scenario("SCN-REPO-050", async ({ sut, given, when, then }) => {
  await given('a module "demo" with the limit "80% in total"', async () => {
    await demoBase(sut, 5);
  });

  await given("a mutation report with 3 killed and 2 survived mutants", async () => {
    const report = mutationReport([
      { line: 1, status: "Killed" },
      { line: 2, status: "Killed" },
      { line: 3, status: "Timeout" },
      { line: 4, status: "Survived" },
      { line: 5, status: "Survived" },
    ]);
    await sut.files.put("$INPUT/reports/mutation/modules-demo.json", report);
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "osf check MUTATION --total"', async () => {
    run = await sut.cli(["check", "MUTATION", "--total"]);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then('the output contains "60% of the mutants of modules/demo were detected, the limit is 80%"', async () => {
    expect(run.stdout).toContain("60% of the mutants of modules/demo were detected, the limit is 80%");
  });
});

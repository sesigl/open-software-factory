import { scenario } from "@opensoftware/testkit";
import { addLines, demoBase } from "./mutation.ts";
import { mutationReport } from "./repo.ts";

scenario("SCN-REPO-049", async ({ sut, given, when, then }) => {
  let base = "";
  await given(
    'a base commit with module "demo", the limit "at least 70% of the mutants in changed lines" and "src/run.ts" of 3 lines',
    async () => {
      base = await demoBase(sut, 3);
    },
  );

  await given('a change that adds lines 4 to 6 to "src/run.ts"', async () => {
    await addLines(sut, 6, [4, 5, 6]);
  });

  await given("a mutation report with a killed mutant on line 5 and a survived mutant on line 2", async () => {
    const report = mutationReport([
      { line: 5, status: "Killed" },
      { line: 2, status: "Survived" },
    ]);
    await sut.files.put("$INPUT/reports/mutation/modules-demo.json", report);
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "osf check MUTATION" against the base commit', async () => {
    run = await sut.cli(["check", "MUTATION"], { env: { OSF_BASE: base } });
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then('the output contains "MUTATION ok"', async () => {
    expect(run.stdout).toContain("MUTATION ok");
  });
});

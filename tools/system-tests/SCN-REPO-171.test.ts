import { scenario } from "@opensoftware/testkit";
import { addLines, demoBase } from "./mutation.ts";
import { mutationReport } from "./repo.ts";

scenario("SCN-REPO-171", async ({ sut, given, when, then }) => {
  let base = "";
  await given(
    'a base commit with module "demo", the limit "at least 70% of the mutants in changed lines" and "src/clock.tsx" of 3 lines',
    async () => {
      base = await demoBase(sut, 3, "src/clock.tsx");
    },
  );

  await given('a change that adds lines 4 to 6 to "src/clock.tsx"', async () => {
    await addLines(sut, 6, [4, 5, 6], "src/clock.tsx");
  });

  await given('a mutation report of "src/clock.tsx" with a killed and a survived mutant on line 5', async () => {
    const report = mutationReport(
      [
        { line: 5, status: "Killed" },
        { line: 5, status: "Survived" },
      ],
      "src/clock.tsx",
    );
    await sut.files.put("$INPUT/reports/mutation/modules-demo.json", report);
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "osf check MUTATION" against the base commit', async () => {
    run = await sut.cli(["check", "MUTATION"], { env: { OSF_BASE: base } });
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then(
    'the output contains "50% of the mutants in changed lines of modules/demo were detected, the limit is 70%"',
    async () => {
      expect(run.stdout).toContain(
        "50% of the mutants in changed lines of modules/demo were detected, the limit is 70%",
      );
    },
  );

  await then(
    'the output contains "MUTATION modules/demo/src/clock.tsx:5 no test notices the mutant ConditionalExpression"',
    async () => {
      expect(run.stdout).toContain(
        "MUTATION modules/demo/src/clock.tsx:5 no test notices the mutant ConditionalExpression",
      );
    },
  );
});

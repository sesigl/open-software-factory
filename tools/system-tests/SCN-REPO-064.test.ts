import { scenario } from "@opensoftware/testkit";
import { addLines, demoBase } from "./mutation.ts";
import { mutationReport } from "./repo.ts";

scenario("SCN-REPO-064", async ({ sut, given, when, then }) => {
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

  await given(
    "a report of shard 1 with a killed mutant on line 4 and a report of shard 2 with survived mutants on lines 5 and 6",
    async () => {
      const first = mutationReport([{ line: 4, status: "Killed" }]);
      const second = mutationReport([
        { line: 5, status: "Survived" },
        { line: 6, status: "Survived" },
      ]);
      await sut.files.put("$INPUT/reports/mutation/modules-demo.shard-1.json", first);
      await sut.files.put("$INPUT/reports/mutation/modules-demo.shard-2.json", second);
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "osf check MUTATION" against the base commit', async () => {
    run = await sut.cli(["check", "MUTATION"], { env: { OSF_BASE: base } });
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then(
    'the output contains "33.3% of the mutants in changed lines of modules/demo were detected, the limit is 70%"',
    async () => {
      expect(run.stdout).toContain(
        "33.3% of the mutants in changed lines of modules/demo were detected, the limit is 70%",
      );
    },
  );
});

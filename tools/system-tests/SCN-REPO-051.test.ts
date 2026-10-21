import { scenario } from "@opensoftware/testkit";
import { addLines, demoBase } from "./mutation.ts";

scenario("SCN-REPO-051", async ({ sut, given, when, then }) => {
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

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "osf check MUTATION" against the base commit', async () => {
    run = await sut.cli(["check", "MUTATION"], { env: { OSF_BASE: base } });
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then(
    'the output contains "no mutation report reports/mutation/modules-demo.json: run make mutation"',
    async () => {
      expect(run.stdout).toContain("no mutation report reports/mutation/modules-demo.json: run make mutation");
    },
  );
});

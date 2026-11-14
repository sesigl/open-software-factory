import { scenario } from "@opensoftware/testkit";
import { qualityLimits } from "./repo.ts";
import { READS, SHOWS, templateOf } from "./templates.ts";

scenario("SCN-REPO-146", async ({ sut, given, when, then }) => {
  await given('the modules "billing" and "payroll" with the limit "Duplication: at most 3%"', async () => {
    for (const name of ["billing", "payroll"]) {
      await sut.files.put(`$INPUT/modules/${name}/package.json`, `{ "name": "@opensoftware/${name}" }\n`);
      await sut.files.put(`$INPUT/modules/${name}/AGENTS.md`, qualityLimits({ duplication: 3 }));
    }
  });

  await given(
    '"modules/billing/src/web/pages/runs.astro" and "modules/payroll/src/web/pages/runs.astro" hold the same template',
    async () => {
      const template = templateOf(SHOWS, [...READS, ...READS, ...READS]);
      for (const name of ["billing", "payroll"])
        await sut.files.put(`$INPUT/modules/${name}/src/web/pages/runs.astro`, template);
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "osf check DUP"', async () => {
    run = await sut.cli(["check", "DUP"]);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then('the output contains "duplicate modules/payroll/src/web/pages/runs.astro"', async () => {
    expect(run.stdout).toContain("duplicate modules/payroll/src/web/pages/runs.astro");
  });
});

import { scenario } from "@opensoftware/testkit";
import { qualityLimits } from "./repo.ts";

scenario("SCN-REPO-046", async ({ sut, given, when, then }) => {
  await given(
    'the modules "billing" and "payroll" with the limit "Duplication: at most 3%" and no clone between them',
    async () => {
      for (const name of ["billing", "payroll"]) {
        await sut.files.put(`$INPUT/modules/${name}/package.json`, `{ "name": "@opensoftware/${name}" }\n`);
        await sut.files.put(`$INPUT/modules/${name}/AGENTS.md`, qualityLimits({ duplication: 3 }));
        await sut.files.put(`$INPUT/modules/${name}/src/sum.ts`, `export const ${name} = 1;\n`);
      }
    },
  );

  await given('"docs/quality/duplication-baseline.json" lists a clone between their files "src/sum.ts"', async () => {
    const baseline = { clones: [["modules/billing/src/sum.ts", "modules/payroll/src/sum.ts"]] };
    await sut.files.put("$INPUT/docs/quality/duplication-baseline.json", `${JSON.stringify(baseline, null, 2)}\n`);
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "osf check DUP"', async () => {
    run = await sut.cli(["check", "DUP"]);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then('the output contains "DUP docs/quality/duplication-baseline.json"', async () => {
    expect(run.stdout).toContain("DUP docs/quality/duplication-baseline.json");
  });

  await then('the output contains "is gone: remove it from the baseline"', async () => {
    expect(run.stdout).toContain("is gone: remove it from the baseline");
  });
});

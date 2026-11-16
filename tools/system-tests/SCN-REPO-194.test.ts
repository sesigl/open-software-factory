import { scenario } from "@opensoftware/testkit";
import { distinctLines, qualityLimits, summingFunction } from "./repo.ts";

scenario("SCN-REPO-194", async ({ sut, given, when, then }) => {
  await given(
    'the modules "billing" and "payroll" with the limit "Duplication: at most 3%" and 800 lines of source each',
    async () => {
      for (const name of ["billing", "payroll"]) {
        await sut.files.put(`$INPUT/modules/${name}/package.json`, `{ "name": "@opensoftware/${name}" }\n`);
        await sut.files.put(`$INPUT/modules/${name}/AGENTS.md`, qualityLimits({ duplication: 3 }));
        await sut.files.put(`$INPUT/modules/${name}/src/rows.ts`, distinctLines(name, 800));
      }
    },
  );

  await given(
    '"modules/billing/src/sum.ts" and "modules/payroll/src/sum.ts" hold the same function of 9 lines',
    async () => {
      await sut.files.put("$INPUT/modules/billing/src/sum.ts", summingFunction("sum"));
      await sut.files.put("$INPUT/modules/payroll/src/sum.ts", summingFunction("sum"));
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "osf check DUP"', async () => {
    run = await sut.cli(["check", "DUP"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });
});

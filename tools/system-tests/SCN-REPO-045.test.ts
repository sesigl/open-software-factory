import { scenario } from "@opensoftware/testkit";
import { qualityLimits, summingFunction } from "./repo.ts";

scenario("SCN-REPO-045", async ({ sut, given, when, then }) => {
  await given('the modules "billing" and "payroll" with the limit "Duplication: at most 3%"', async () => {
    for (const name of ["billing", "payroll"]) {
      await sut.files.put(`$INPUT/modules/${name}/package.json`, `{ "name": "@opensoftware/${name}" }\n`);
      await sut.files.put(`$INPUT/modules/${name}/AGENTS.md`, qualityLimits({ duplication: 3 }));
    }
  });

  await given('"modules/billing/src/sum.ts" and "modules/payroll/src/sum.ts" hold the same function', async () => {
    await sut.files.put("$INPUT/modules/billing/src/sum.ts", summingFunction("sum"));
    await sut.files.put("$INPUT/modules/payroll/src/sum.ts", summingFunction("sum"));
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "osf check DUP"', async () => {
    run = await sut.cli(["check", "DUP"]);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then('the output contains "duplicate modules/payroll/src/sum.ts"', async () => {
    expect(run.stdout).toContain("duplicate modules/payroll/src/sum.ts");
  });

  await then('the output contains "move the shared code into a package in packages/ or into contracts/"', async () => {
    expect(run.stdout).toContain("move the shared code into a package in packages/ or into contracts/");
  });
});

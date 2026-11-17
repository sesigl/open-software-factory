import { scenario } from "@opensoftware/testkit";
import { distinctLines, invoiceFunction, qualityLimits } from "./repo.ts";

scenario("SCN-REPO-195", async ({ sut, given, when, then }) => {
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
    '"modules/billing/src/sum.ts" and "modules/payroll/src/sum.ts" hold the same function of 17 lines',
    async () => {
      await sut.files.put("$INPUT/modules/billing/src/sum.ts", invoiceFunction());
      await sut.files.put("$INPUT/modules/payroll/src/sum.ts", invoiceFunction());
    },
  );

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

  await then(
    'the output contains "keep a copy of at most 15 lines, or move the code into an existing library whose job it fits (cli, testkit, contracts, factory-source, spec-files); a new package needs the bar of ADR 0159"',
    async () => {
      expect(run.stdout).toContain(
        "keep a copy of at most 15 lines, or move the code into an existing library whose job it fits (cli, testkit, contracts, factory-source, spec-files); a new package needs the bar of ADR 0159",
      );
    },
  );
});

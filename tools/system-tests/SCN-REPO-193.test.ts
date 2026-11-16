import { scenario } from "@opensoftware/testkit";
import { acceptedAdr } from "./repo.ts";

scenario("SCN-REPO-193", async ({ sut, given, when, then }) => {
  let base = "";
  await given('a base commit without the packages "packages/rates" and "packages/scratch"', async () => {
    await sut.files.put("$INPUT/README.md", "# demo\n");
    base = await sut.git.commit("base");
  });

  await given(
    'a change that adds the published package "@opensoftware/rates" and the private package "packages/scratch"',
    async () => {
      await sut.files.put(
        "$INPUT/packages/rates/package.json",
        '{\n  "name": "@opensoftware/rates",\n  "version": "0.1.0"\n}\n',
      );
      await sut.files.put(
        "$INPUT/packages/scratch/package.json",
        '{\n  "name": "@opensoftware/scratch",\n  "private": true\n}\n',
      );
    },
  );

  await given('an accepted ADR that names "@opensoftware/rates" and answers "Why a package"', async () => {
    const why = [
      "## Why a package",
      "",
      "It converts amounts between currencies; billing and payroll use it today; 400 lines.",
      "",
      "## Consequences",
    ].join("\n");
    const adr = acceptedAdr("0001", "the library `@opensoftware/rates`").replace("## Consequences", why);
    await sut.files.put("$INPUT/docs/decisions/0001-rates.md", adr);
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "osf check ADR" against the base commit', async () => {
    run = await sut.cli(["check", "ADR"], { env: { OSF_BASE: base } });
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });
});

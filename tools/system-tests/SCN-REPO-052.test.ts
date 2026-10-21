import { scenario } from "@opensoftware/testkit";
import { DEMO_PACKAGE, qualityLimits } from "./repo.ts";

scenario("SCN-REPO-052", async ({ sut, given, when, then }) => {
  await given(
    'a module "demo" with a source file, its quality limits and a package.json without a "mutation" script',
    async () => {
      await sut.files.put("$INPUT/modules/demo/package.json", DEMO_PACKAGE);
      await sut.files.put("$INPUT/modules/demo/AGENTS.md", qualityLimits());
      await sut.files.put("$INPUT/modules/demo/src/run.ts", "export const run = 1;\n");
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "osf check MUTATION --total"', async () => {
    run = await sut.cli(["check", "MUTATION", "--total"]);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then('the output contains "MUTATION modules/demo/package.json"', async () => {
    expect(run.stdout).toContain("MUTATION modules/demo/package.json");
  });

  await then(`the output contains 'has no "mutation" script'`, async () => {
    expect(run.stdout).toContain('has no "mutation" script');
  });
});

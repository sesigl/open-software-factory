import { scenario } from "@opensoftware/testkit";
import { qualityLimits } from "./repo.ts";

scenario("SCN-REPO-058", async ({ sut, given, when, then }) => {
  await given(
    'a library "packages/money" with a source file, its quality limits and a package.json without a "mutation" script and without a bin',
    async () => {
      const manifest = { name: "@opensoftware/money", version: "0.1.0", type: "module" };
      await sut.files.put("$INPUT/packages/money/package.json", `${JSON.stringify(manifest, null, 2)}\n`);
      await sut.files.put("$INPUT/packages/money/AGENTS.md", qualityLimits());
      await sut.files.put("$INPUT/packages/money/src/index.ts", "export const cents = 100;\n");
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "osf check MUTATION --total"', async () => {
    run = await sut.cli(["check", "MUTATION", "--total"]);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then('the output contains "MUTATION packages/money/package.json"', async () => {
    expect(run.stdout).toContain("MUTATION packages/money/package.json");
  });

  await then(`the output contains 'has no "mutation" script'`, async () => {
    expect(run.stdout).toContain('has no "mutation" script');
  });
});

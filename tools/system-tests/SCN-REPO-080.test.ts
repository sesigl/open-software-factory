import { scenario } from "@opensoftware/testkit";

scenario("SCN-REPO-080", async ({ sut, given, when, then }) => {
  await given(
    'a repository with the module "demo" and the adapter "adapters/forge/github" named "@opensoftware/forge-github"',
    async () => {
      await sut.files.put(
        "$INPUT/adapters/forge/github/package.json",
        '{ "name": "@opensoftware/forge-github", "version": "0.1.0" }\n',
      );
      await sut.files.put("$INPUT/modules/demo/src/run.ts", "export const run = () => 1;\n");
    },
  );

  await given(
    '"modules/demo/package.json" declares "@opensoftware/forge-github" in its "devDependencies"',
    async () => {
      const manifest = {
        name: "@opensoftware/demo",
        version: "0.1.0",
        devDependencies: { "@opensoftware/forge-github": "0.1.0" },
      };
      await sut.files.put("$INPUT/modules/demo/package.json", `${JSON.stringify(manifest, null, 2)}\n`);
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "osf check ISOLATION"', async () => {
    run = await sut.cli(["check", "ISOLATION"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then('the output contains "ISOLATION ok"', async () => {
    expect(run.stdout).toContain("ISOLATION ok");
  });
});

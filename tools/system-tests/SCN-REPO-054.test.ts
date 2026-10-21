import { scenario } from "@opensoftware/testkit";

scenario("SCN-REPO-054", async ({ sut, given, when, then }) => {
  await given(
    'a repository with the module "demo" and the library "packages/money" named "@opensoftware/money"',
    async () => {
      await sut.files.put(
        "$INPUT/packages/money/package.json",
        '{ "name": "@opensoftware/money", "version": "0.1.0" }\n',
      );
      await sut.files.put(
        "$INPUT/packages/money/src/index.ts",
        "export const cents = (value: number) => value * 100;\n",
      );
      await sut.files.put("$INPUT/modules/demo/src/run.ts", "export const run = () => 1;\n");
    },
  );

  await given('"modules/demo/package.json" depends on "@opensoftware/money"', async () => {
    const manifest = { name: "@opensoftware/demo", version: "0.1.0", dependencies: { "@opensoftware/money": "0.1.0" } };
    await sut.files.put("$INPUT/modules/demo/package.json", `${JSON.stringify(manifest, null, 2)}\n`);
  });

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

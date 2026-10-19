import { scenario } from "@opensoftware/testkit";

scenario("SCN-REPO-009", async ({ sut, given, when, then }) => {
  await given('a repository with the modules "demo" and "other"', async () => {
    for (const name of ["demo", "other"]) {
      await sut.files.put(`modules/${name}/package.json`, `{ "name": "@opensoftware/${name}", "version": "0.1.0" }\n`);
      await sut.files.put(`modules/${name}/src/index.ts`, "export const value = 1;\n");
    }
  });

  await given('"modules/demo/src/run.ts" imports "../../other/src/index.ts"', async () => {
    await sut.files.put(
      "modules/demo/src/run.ts",
      'import { value } from "../../other/src/index.ts";\nexport const run = () => value;\n',
    );
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "osf check ISOLATION"', async () => {
    run = await sut.cli(["check", "ISOLATION"]);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode).toBe(1);
  });

  await then('the output contains "ISOLATION modules/demo/src/run.ts:1"', async () => {
    expect(run.stdout).toContain("ISOLATION modules/demo/src/run.ts:1");
  });
});

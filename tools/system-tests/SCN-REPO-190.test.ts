import { scenario } from "@opensoftware/testkit";
import { putCached, runAffected } from "./affected.ts";
import { testedPackage } from "./repo.ts";

scenario("SCN-REPO-190", async ({ sut, given, when, then }) => {
  await given(
    'a repository that caches the system tests of the modules "demo" and "other" by the rules of ADR 0081',
    async () => {
      await putCached(sut);
    },
  );

  await given(
    'the script "test:system" of "modules/demo/package.json" first runs "node scripts/images.ts", which reads "deploy/images/Dockerfile"',
    async () => {
      const manifest = JSON.parse(testedPackage("demo")["modules/demo/package.json"] as string);
      manifest.scripts["test:system"] = "node scripts/images.ts && vitest run";
      await putCached(sut, {
        "modules/demo/package.json": `${JSON.stringify(manifest, null, 2)}\n`,
        "modules/demo/scripts/images.ts": [
          'import { readFileSync } from "node:fs";',
          'export const dockerfile = readFileSync(join(root, "deploy/images/Dockerfile"), "utf8");',
          "",
        ].join("\n"),
        "deploy/images/Dockerfile": "FROM node:24\n",
      });
    },
  );

  let run: Awaited<ReturnType<typeof runAffected>>;
  await when('the developer runs "osf check AFFECTED"', async () => {
    run = await runAffected(sut);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then(
    'the output contains "AFFECTED modules/demo/scripts/images.ts:2 reads "deploy/images/Dockerfile" outside its package: declare the package, list the path in the inputs of test:system in modules/demo/turbo.json or in globalDependencies of turbo.json"',
    async () => {
      expect(run.stdout).toContain(
        'AFFECTED modules/demo/scripts/images.ts:2 reads "deploy/images/Dockerfile" outside its package: declare the package, list the path in the inputs of test:system in modules/demo/turbo.json or in globalDependencies of turbo.json',
      );
    },
  );
});

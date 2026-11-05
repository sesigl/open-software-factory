import { scenario } from "@opensoftware/testkit";
import { putModules, releaseFiles } from "./release.ts";

scenario("SCN-REPO-086", async ({ sut, given, when, then }) => {
  await given(
    'a repository with the published module "demo" at version "0.3.0" and the private module "other"',
    async () => {
      await putModules(sut);
    },
  );

  let run: Awaited<ReturnType<typeof releaseFiles>>;
  await when('the developer runs "osf release-files"', async () => {
    run = await releaseFiles(sut);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then('".github/workflows/publish-demo.yml" publishes "@opensoftware/demo" from "modules/demo"', async () => {
    const workflow = await sut.files.read("$INPUT/.github/workflows/publish-demo.yml");
    expect(workflow).toContain("name: publish-demo\n");
    expect(workflow).toContain('pnpm --filter "@opensoftware/demo..." build');
    expect(workflow).toContain("pnpm --dir modules/demo pack");
  });

  await then(
    '"release-please-config.json" has the entry "modules/demo" with the component "demo" and the initial version "0.1.0"',
    async () => {
      const config = JSON.parse(await sut.files.read("$INPUT/release-please-config.json"));
      expect(config.packages["modules/demo"]).toEqual({
        "release-type": "node",
        "package-name": "@opensoftware/demo",
        component: "demo",
        "initial-version": "0.1.0",
        "bump-minor-pre-major": true,
      });
    },
  );

  await then('".release-please-manifest.json" gives "modules/demo" the version "0.3.0"', async () => {
    expect(JSON.parse(await sut.files.read("$INPUT/.release-please-manifest.json"))).toEqual({
      "modules/demo": "0.3.0",
    });
  });

  await then('no release file names "other"', async () => {
    expect(await sut.files.list("$INPUT/.github/workflows")).toEqual(["publish-demo.yml"]);
    expect(await sut.files.read("$INPUT/release-please-config.json")).not.toContain("other");
  });
});

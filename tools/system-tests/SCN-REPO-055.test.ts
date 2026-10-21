import { scenario } from "@opensoftware/testkit";

const openapi = (version: string): string =>
  `${JSON.stringify({ openapi: "3.1.0", info: { title: "demo", version } }, null, 2)}\n`;

scenario("SCN-REPO-055", async ({ sut, given, when, then }) => {
  let base = "";
  await given('a base commit with a doc "docs/how-to/demo.md" that covers "modules/demo/**"', async () => {
    await sut.files.put("$INPUT/docs/how-to/demo.md", "---\ncovers: [modules/demo/**]\n---\n\n# Use demo\n");
    await sut.files.put("$INPUT/modules/demo/openapi.json", openapi("0.1.0"));
  });

  await given(
    'a release-please config whose package "modules/demo" lists the extra file "openapi.json" with the jsonpath "$.info.version"',
    async () => {
      const config = {
        packages: {
          "modules/demo": { "extra-files": [{ type: "json", path: "openapi.json", jsonpath: "$.info.version" }] },
        },
      };
      await sut.files.put("$INPUT/release-please-config.json", `${JSON.stringify(config, null, 2)}\n`);
      base = await sut.git.commit("base");
    },
  );

  await given('a change that sets "info.version" in "modules/demo/openapi.json" to "0.2.0"', async () => {
    await sut.files.put("$INPUT/modules/demo/openapi.json", openapi("0.2.0"));
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "osf docs-affected" against the base commit', async () => {
    run = await sut.cli(["docs-affected"], { env: { OSF_BASE: base } });
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode).toBe(0);
  });
});

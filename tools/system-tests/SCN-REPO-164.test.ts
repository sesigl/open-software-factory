import { scenario } from "@opensoftware/testkit";
import { putAll } from "./repo.ts";
import { putShipped, runShipped } from "./shipped.ts";

scenario("SCN-REPO-164", async ({ sut, given, when, then }) => {
  const manifest: Record<string, unknown> = {};
  let serve: string[] = [];
  await given(
    'the published module "demo" whose bin "dist/cli.js" is built from "src/cli.ts", which imports "./serve.ts"',
    async () => {
      await putShipped(sut, serve, manifest);
    },
  );

  await given('"ui" is only in the devDependencies of "demo", and "yaml" in its dependencies', async () => {
    Object.assign(manifest, { dependencies: { yaml: "2.9.1" }, devDependencies: { ui: "workspace:*" } });
    await putShipped(sut, serve, manifest);
  });

  await given(
    '"src/serve.ts" has "import type" and "export type" of "ui", imports "node:fs", "fs/promises", "yaml" and "@opensoftware/demo/package.json", and resolves "./page.html"',
    async () => {
      serve = [
        'import type { Shell } from "ui";',
        'export type { Page } from "ui";',
        'import { readFileSync } from "node:fs";',
        'import { readFile } from "fs/promises";',
        'import { createRequire } from "node:module";',
        'import { parse } from "yaml";',
        'import own from "@opensoftware/demo/package.json" with { type: "json" };',
        'export const page = readFileSync(createRequire(import.meta.url).resolve("./page.html"));',
        "export const used = [readFile, parse, own] as unknown as Shell;",
      ];
      await putShipped(sut, serve, manifest);
    },
  );

  await given(
    'the Astro template "src/web/pages/index.astro", the file "src/web/theme.ts" and the system test "system-tests/SCN-DEMO-001.test.ts" import "ui"',
    async () => {
      await putAll(sut, {
        "modules/demo/src/web/pages/index.astro": '---\nimport Page from "ui/components/Page.astro";\n---\n<Page />\n',
        "modules/demo/src/web/theme.ts": 'export { theme } from "ui";\n',
        "modules/demo/system-tests/SCN-DEMO-001.test.ts": 'import { Button } from "ui";\n\nexport { Button };\n',
      });
    },
  );

  await given('the private package "tools" imports "ui" in its bin "bin/osf.ts"', async () => {
    await putAll(sut, {
      "tools/package.json": `${JSON.stringify({ name: "@opensoftware/tools", private: true, bin: { osf: "bin/osf.ts" } })}\n`,
      "tools/bin/osf.ts": 'import { Button } from "ui";\n\nexport { Button };\n',
    });
  });

  let run: Awaited<ReturnType<typeof runShipped>>;
  await when('the developer runs "osf check DEPS-RUNTIME"', async () => {
    run = await runShipped(sut);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then('the output contains "DEPS-RUNTIME ok"', async () => {
    expect(run.stdout).toContain("DEPS-RUNTIME ok\n");
  });
});

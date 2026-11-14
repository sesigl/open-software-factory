import { scenario } from "@opensoftware/testkit";
import { devOnly, putShipped, runShipped } from "./shipped.ts";

scenario("SCN-REPO-162", async ({ sut, given, when, then }) => {
  const manifest: Record<string, unknown> = {};
  let serve: string[] = [];
  await given(
    'the published module "demo" whose bin "dist/cli.js" is built from "src/cli.ts", which imports "./serve.ts"',
    async () => {
      await putShipped(sut, serve, manifest);
    },
  );

  await given('"ui" is only in the devDependencies of "demo"', async () => {
    manifest.devDependencies = { ui: "workspace:*" };
    await putShipped(sut, serve, manifest);
  });

  await given(
    '"src/serve.ts" imports "ui" on line 2 and resolves "ui/brand/favicon.svg" with "createRequire(import.meta.url).resolve" on line 3',
    async () => {
      serve = [
        'import { createRequire } from "node:module";',
        'import { Button } from "ui";',
        'export const favicon = createRequire(import.meta.url).resolve("ui/brand/favicon.svg");',
        "export const button = Button;",
      ];
      await putShipped(sut, serve, manifest);
    },
  );

  let run: Awaited<ReturnType<typeof runShipped>>;
  await when('the developer runs "osf check DEPS-RUNTIME"', async () => {
    run = await runShipped(sut);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then(
    'the output contains "DEPS-RUNTIME modules/demo/src/serve.ts:2 ui is only a devDependency, which npm does not install with @opensoftware/demo: move it to dependencies, or stop loading it at run time"',
    async () => {
      expect(run.stdout).toContain(devOnly(2, "ui"));
    },
  );

  await then(
    'the output contains "DEPS-RUNTIME modules/demo/src/serve.ts:3 ui is only a devDependency, which npm does not install with @opensoftware/demo: move it to dependencies, or stop loading it at run time"',
    async () => {
      expect(run.stdout).toContain(devOnly(3, "ui"));
      expect(run.stdout).toContain("DEPS-RUNTIME failed: 2\n");
    },
  );
});

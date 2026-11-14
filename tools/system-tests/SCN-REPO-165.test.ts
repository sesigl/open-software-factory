import { scenario } from "@opensoftware/testkit";
import { devOnly, putShipped, runShipped } from "./shipped.ts";

scenario("SCN-REPO-165", async ({ sut, given, when, then }) => {
  const manifest: Record<string, unknown> = {};
  let serve: string[] = [];
  await given(
    'the published module "demo" whose bin "dist/cli.js" is built from "src/cli.ts", which imports "./serve.ts"',
    async () => {
      await putShipped(sut, serve, manifest);
    },
  );

  await given(
    'its build script is "node ../../tools/bin/bundle.ts ." and "chat" is only in its devDependencies',
    async () => {
      Object.assign(manifest, {
        scripts: { build: "node ../../tools/bin/bundle.ts ." },
        devDependencies: { chat: "4.43.0" },
      });
      await putShipped(sut, serve, manifest);
    },
  );

  await given(
    '"src/serve.ts" imports "chat" on line 1 and resolves "chat/package.json" with "createRequire(import.meta.url).resolve" on line 3',
    async () => {
      serve = [
        'import { Chat } from "chat";',
        'import { createRequire } from "node:module";',
        'export const manifest = createRequire(import.meta.url).resolve("chat/package.json");',
        "export const chat = Chat;",
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
    'the output contains "DEPS-RUNTIME modules/demo/src/serve.ts:3 chat is only a devDependency, which npm does not install with @opensoftware/demo: move it to dependencies, or stop loading it at run time"',
    async () => {
      expect(run.stdout).toContain(devOnly(3, "chat"));
    },
  );

  await then('the output does not name "src/serve.ts:1"', async () => {
    expect(run.stdout).not.toContain("src/serve.ts:1 ");
    expect(run.stdout).toContain("DEPS-RUNTIME failed: 1\n");
  });
});

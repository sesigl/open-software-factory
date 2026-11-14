import { scenario } from "@opensoftware/testkit";
import { putShipped, runShipped, undeclared } from "./shipped.ts";

scenario("SCN-REPO-163", async ({ sut, given, when, then }) => {
  await given(
    'the published module "demo" whose bin "dist/cli.js" is built from "src/cli.ts", which imports "./serve.ts"',
    async () => {
      await putShipped(sut, []);
    },
  );

  await given(
    '"src/serve.ts" loads "left-pad" with "import()" on line 1, with a require of "createRequire" on line 4 and with "import.meta.resolve" on line 5',
    async () => {
      await putShipped(sut, [
        'export const pad = await import("left-pad");',
        'import module from "node:module";',
        "const load = module.createRequire(import.meta.url);",
        "export const padded = load(`left-pad`);",
        'export const where = import.meta.resolve("left-pad/index.js");',
      ]);
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
    'the output contains "DEPS-RUNTIME modules/demo/src/serve.ts:1 left-pad is no dependency of @opensoftware/demo: add it to dependencies, or stop loading it at run time"',
    async () => {
      expect(run.stdout).toContain(undeclared(1, "left-pad"));
    },
  );

  await then('the output names "src/serve.ts:4" and "src/serve.ts:5" with the same message', async () => {
    expect(run.stdout).toContain(undeclared(4, "left-pad"));
    expect(run.stdout).toContain(undeclared(5, "left-pad"));
    expect(run.stdout).toContain("DEPS-RUNTIME failed: 3\n");
  });
});

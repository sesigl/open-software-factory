import { scenario } from "@opensoftware/testkit";
import { putLibrary } from "./surface.ts";

scenario("SCN-REPO-154", async ({ sut, given, when, then }) => {
  await given(
    'the library "demo" whose "src/index.ts" exports the values "openPool", "closePool" and "POOL_SIZE" and three types, and whose AGENTS.md names the three values',
    async () => {
      await putLibrary(
        sut,
        [
          'export { type Pool, openPool } from "./pool.ts";',
          'export type { PoolOptions } from "./options.ts";',
          "export function closePool(): void {}",
          "export const POOL_SIZE = 10;",
          "export interface PoolHandle { size: number }",
        ],
        ["openPool", "closePool", "POOL_SIZE"],
      );
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "osf check SURFACE"', async () => {
    run = await sut.cli(["check", "SURFACE"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then('the output contains "SURFACE ok"', async () => {
    expect(run.stdout).toContain("SURFACE ok");
  });
});

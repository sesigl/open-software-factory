import { scenario } from "@opensoftware/testkit";
import { putLibrary } from "./surface.ts";

scenario("SCN-REPO-153", async ({ sut, given, when, then }) => {
  await given(
    'the library "demo" whose "src/index.ts" exports "openPool" and "closePool", and whose AGENTS.md names only "openPool"',
    async () => {
      await putLibrary(
        sut,
        ['export { openPool } from "./pool.ts";', 'export { closePool } from "./pool.ts";'],
        ["openPool"],
      );
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "osf check SURFACE"', async () => {
    run = await sut.cli(["check", "SURFACE"]);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then(
    'the output contains "SURFACE packages/demo/src/index.ts:2 closePool is exported but not named in the \\"Public surface\\" of packages/demo/AGENTS.md: name it there, or stop exporting it"',
    async () => {
      expect(run.stdout).toContain(
        'SURFACE packages/demo/src/index.ts:2 closePool is exported but not named in the "Public surface" of packages/demo/AGENTS.md: name it there, or stop exporting it\n',
      );
      expect(run.stdout).not.toContain("openPool is exported");
    },
  );
});

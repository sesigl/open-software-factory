import { scenario } from "@opensoftware/testkit";
import { putLibrary } from "./surface.ts";

scenario("SCN-REPO-155", async ({ sut, given, when, then }) => {
  await given('the library "demo" whose "src/index.ts" has "export * from \'./pool.ts\'"', async () => {
    await putLibrary(sut, ["export * from './pool.ts';"], ["openPool"]);
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "osf check SURFACE"', async () => {
    run = await sut.cli(["check", "SURFACE"]);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then(
    'the output contains "SURFACE packages/demo/src/index.ts:1 export * hides what the library adds: export each value by name"',
    async () => {
      expect(run.stdout).toContain(
        "SURFACE packages/demo/src/index.ts:1 export * hides what the library adds: export each value by name\n",
      );
    },
  );
});

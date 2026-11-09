import { scenario } from "@opensoftware/testkit";
import { type Lock, putLocked, runDeps } from "./deps.ts";

scenario("SCN-REPO-103", async ({ sut, given, when, then }) => {
  const lock: Lock = {};
  await given(
    'a lockfile in which "modules/demo" depends on "pair" 1.0.0, which needs its peer "base" exactly at 2.0.0',
    async () => {
      await putLocked(sut, lock);
    },
  );

  await given('"modules/demo" depends on "base" 2.0.0', async () => {
    Object.assign(lock, { base: "2.0.0" });
    await putLocked(sut, lock);
  });

  let run: Awaited<ReturnType<typeof runDeps>>;
  await when('the developer runs "osf check DEPS"', async () => {
    run = await runDeps(sut);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then('the output contains "DEPS ok"', async () => {
    expect(run.stdout).toContain("DEPS ok");
  });
});

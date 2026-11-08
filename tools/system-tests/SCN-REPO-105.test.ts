import { scenario } from "@opensoftware/testkit";
import { type Lock, putLocked, runDeps } from "./deps.ts";

scenario("SCN-REPO-105", async ({ sut, given, when, then }) => {
  const lock: Lock = {};
  await given(
    'a lockfile in which "modules/demo" depends on "pair" 1.0.0, which needs its peer "base" exactly at 2.0.0',
    async () => {
      await putLocked(sut, lock);
    },
  );

  await given('"pair" 1.0.0 also needs the optional peer "extra" exactly at 3.0.0', async () => {
    Object.assign(lock, { extra: true });
    await putLocked(sut, lock);
  });

  let run: Awaited<ReturnType<typeof runDeps>>;
  await when('the developer runs "osf check DEPS"', async () => {
    run = await runDeps(sut);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then(
    'the output contains "DEPS modules/demo/package.json:1 pair 1.0.0 needs base 2.0.0 exactly; the package does not declare it"',
    async () => {
      expect(run.stdout).toContain(
        "DEPS modules/demo/package.json:1 pair 1.0.0 needs base 2.0.0 exactly; the package does not declare it",
      );
    },
  );

  await then('the output does not contain "extra"', async () => {
    expect(run.stdout).not.toContain("extra");
  });
});

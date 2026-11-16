import { scenario } from "@opensoftware/testkit";
import { DEMO_TEST_FILE, demoTest, putCached, runAffected } from "./affected.ts";

const TAKES_COMPOSE = demoTest('const files = fakes.fromRepository("deploy/compose");');

scenario("SCN-REPO-189", async ({ sut, given, when, then }) => {
  await given(
    'a repository that caches the system tests of the modules "demo" and "other" by the rules of ADR 0081',
    async () => {
      await putCached(sut);
    },
  );

  await given(
    '"modules/demo/system-tests/SCN-DEMO-001.test.ts" takes the folder "deploy/compose" with "fakes.fromRepository"',
    async () => {
      await putCached(sut, { [DEMO_TEST_FILE]: TAKES_COMPOSE });
    },
  );

  await given(
    '"modules/demo/turbo.json" gives "test:system" the inputs "$TURBO_EXTENDS$" and "$TURBO_ROOT$/deploy/compose/**"',
    async () => {
      const inputs = ["$TURBO_EXTENDS$", "$TURBO_ROOT$/deploy/compose/**"];
      const turbo = { extends: ["//"], tasks: { "test:system": { inputs } } };
      await putCached(sut, {
        [DEMO_TEST_FILE]: TAKES_COMPOSE,
        "modules/demo/turbo.json": `${JSON.stringify(turbo)}\n`,
      });
    },
  );

  let run: Awaited<ReturnType<typeof runAffected>>;
  await when('the developer runs "osf check AFFECTED"', async () => {
    run = await runAffected(sut);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then('the output contains "AFFECTED ok"', async () => {
    expect(run.stdout).toContain("AFFECTED ok");
  });
});

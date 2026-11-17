import { runProgram, testHook } from "@opensoftware/cli";
import { scenario } from "@opensoftware/testkit";
import { capture, demo, lines, type Ran } from "./program.ts";

const NOW = "2026-01-01T00:00:00Z";

scenario("SCN-CLI-022", async ({ given, when, then }) => {
  let envs: Record<string, string>[] = [];
  await given(
    'the program "demo" whose command asks testHook for "OSF_NOW" in an environment with "OSF_NOW" set to "2026-01-01T00:00:00Z", once without "OSF_TEST_HOOKS" and once with it set to "true"',
    async () => {
      envs = [{ OSF_NOW: NOW }, { OSF_NOW: NOW, OSF_TEST_HOOKS: "true" }];
    },
  );

  let runs: Ran[] = [];
  await when("the module runs the program in each environment", async () => {
    const run = (env: Record<string, string>) =>
      capture((io) =>
        runProgram(
          demo(() => ({ lines: [testHook(env, "OSF_NOW") ?? "the clock"] })),
          io,
        ),
      );
    runs = await Promise.all(envs.map(run));
  });

  await then("each exit code is 2", async () => {
    expect(runs.map((run) => run.exitCode)).toEqual([2, 2]);
  });

  await then(
    'each standard error is "demo: OSF_NOW is a test hook, which works only with OSF_TEST_HOOKS=1 in the system tests: unset OSF_NOW"',
    async () => {
      const line = lines(
        "demo: OSF_NOW is a test hook, which works only with OSF_TEST_HOOKS=1 in the system tests: unset OSF_NOW",
      );
      expect(runs.map((run) => [run.stderr, run.stdout])).toEqual([
        [line, ""],
        [line, ""],
      ]);
    },
  );
});

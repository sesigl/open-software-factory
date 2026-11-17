import { scenario } from "@opensoftware/testkit";

const refusal = (name: string) =>
  `console: ${name} is a test hook, which works only with OSF_TEST_HOOKS=1 in the system tests: unset ${name}\n`;

scenario("SCN-CONSOLE-282", async ({ sut, given, when, then }) => {
  let env: Record<string, string> = {};
  await given('a console without "CONSOLE_FOREMAN_URL"', async () => {
    env = { OSF_TEST_HOOKS: "" };
  });

  let runs: Awaited<ReturnType<typeof sut.cli>>[] = [];
  await when(
    'the user runs "console serve" with "OSF_NOW" set to "2026-01-01T05:00:00Z", and "console doctor --deep" with "OSF_SEED" set to "7", each with "OSF_TEST_HOOKS" set to ""',
    async () => {
      runs = [
        await sut.cli(["serve"], { env: { ...env, OSF_NOW: "2026-01-01T05:00:00Z" } }),
        await sut.cli(["doctor", "--deep"], { env: { ...env, OSF_SEED: "7" } }),
      ];
    },
  );

  await then("each command exits with code 2", async () => {
    expect(runs.map((run) => run.exitCode)).toEqual([2, 2]);
  });

  await then(
    'their error outputs are "console: OSF_NOW is a test hook, which works only with OSF_TEST_HOOKS=1 in the system tests: unset OSF_NOW" and "console: OSF_SEED is a test hook, which works only with OSF_TEST_HOOKS=1 in the system tests: unset OSF_SEED"',
    async () => {
      expect(runs.map((run) => [run.stderr, run.stdout])).toEqual([
        [refusal("OSF_NOW"), ""],
        [refusal("OSF_SEED"), ""],
      ]);
    },
  );
});

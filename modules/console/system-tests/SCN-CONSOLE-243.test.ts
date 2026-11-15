import { scenario } from "@opensoftware/testkit";
import { changesEnv, doctorOf, factoryRepository } from "./changes.ts";

scenario("SCN-CONSOLE-243", async ({ sut, fakes, given, when, then }) => {
  let env: Record<string, string> = {};
  await given(
    'a factory repository "tester/factory" on the forge whose branch "main" has no rules, and a console for it',
    async () => {
      env = changesEnv(sut, await factoryRepository(fakes, false));
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "console doctor"', async () => {
    run = await doctorOf(sut, fakes, env);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then('it prints "ok    factory repository"', async () => {
    expect(run.stdout).toContain("ok    factory repository\n");
  });

  await then(
    'it prints "FAIL  factory check: the branch main of tester/factory does not require the check factory, so the console refuses every change: require the check factory on main, with no approval"',
    async () => {
      expect(run.stdout).toContain(
        "FAIL  factory check: the branch main of tester/factory does not require the check factory, so the console refuses every change: require the check factory on main, with no approval\n",
      );
    },
  );
});

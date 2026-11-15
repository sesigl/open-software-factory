import { scenario } from "@opensoftware/testkit";
import { changesEnv, doctorOf, factoryRepository } from "./changes.ts";

scenario("SCN-CONSOLE-244", async ({ sut, fakes, given, when, then }) => {
  let env: Record<string, string> = {};
  await given(
    'a factory repository "tester/factory" on the forge whose branch "main" requires the check "factory" and one approval, and a console for it',
    async () => {
      env = changesEnv(sut, await factoryRepository(fakes, true, 1));
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "console doctor"', async () => {
    run = await doctorOf(sut, fakes, env);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then(
    'it prints "FAIL  factory check: the branch main of tester/factory requires an approval, which the user of CONSOLE_FACTORY_TOKEN cannot give to its own pull request, so no change merges: require only the check factory on main"',
    async () => {
      expect(run.stdout).toContain(
        "FAIL  factory check: the branch main of tester/factory requires an approval, which the user of CONSOLE_FACTORY_TOKEN cannot give to its own pull request, so no change merges: require only the check factory on main\n",
      );
    },
  );
});

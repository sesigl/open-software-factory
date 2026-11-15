import { scenario } from "@opensoftware/testkit";
import { changesEnv, doctorOf, factoryRepository, makePrivate } from "./changes.ts";

scenario("SCN-CONSOLE-241", async ({ sut, fakes, given, when, then }) => {
  let env: Record<string, string> = {};
  await given(
    'a private factory repository "tester/factory" on the forge whose branch "main" requires the check "factory" and no approval, and a console with "CONSOLE_FACTORY_REPOSITORY", "CONSOLE_FACTORY_TOKEN" and "CONSOLE_FACTORY_USER" for it',
    async () => {
      const forge = await factoryRepository(fakes);
      // Without the token Git cannot fetch it: the check proves the fetch with CONSOLE_FACTORY_TOKEN.
      await makePrivate(forge);
      env = changesEnv(sut, forge);
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "console doctor"', async () => {
    run = await doctorOf(sut, fakes, env);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then('it prints "ok    factory repository" and "ok    factory check"', async () => {
    expect(run.stdout).toContain("ok    factory repository\nok    factory check\n");
  });
});

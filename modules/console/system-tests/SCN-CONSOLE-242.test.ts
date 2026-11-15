import { scenario } from "@opensoftware/testkit";
import { doctorOf, unreachableEnv } from "./changes.ts";

scenario("SCN-CONSOLE-242", async ({ sut, fakes, given, when, then }) => {
  let env: Record<string, string> = {};
  await given(
    'a console whose "CONSOLE_FACTORY_REPOSITORY" and "CONSOLE_FORGE_URL" name "http://127.0.0.1:9", where nothing listens',
    async () => {
      env = { ...unreachableEnv(sut), CONSOLE_FACTORY_TOKEN: "factory-token-1" };
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "console doctor"', async () => {
    run = await doctorOf(sut, fakes, env);
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  const line = (name: string) => run.stdout.split("\n").find((each) => each.startsWith(`FAIL  ${name}: `)) ?? "";

  await then(
    'it prints "FAIL  factory repository: cannot fetch main of http://127.0.0.1:9/tester/factory.git: <Git\'s message>: check CONSOLE_FACTORY_REPOSITORY and CONSOLE_FACTORY_TOKEN"',
    async () => {
      const fetched = line("factory repository");
      expect(fetched).toMatch(
        /^FAIL {2}factory repository: cannot fetch main of http:\/\/127\.0\.0\.1:9\/tester\/factory\.git: \S/,
      );
      expect(fetched).toMatch(/: check CONSOLE_FACTORY_REPOSITORY and CONSOLE_FACTORY_TOKEN$/);
      expect(run.stdout).not.toContain("factory-token-1");
    },
  );

  await then(
    'it prints "FAIL  factory check: <the forge adapter\'s error>: check that CONSOLE_FACTORY_TOKEN may read the rules of main, and CONSOLE_FORGE_ADAPTER and CONSOLE_FORGE_URL"',
    async () => {
      const rules = line("factory check");
      expect(rules).toMatch(/^FAIL {2}factory check: \S/);
      expect(rules).toMatch(
        /: check that CONSOLE_FACTORY_TOKEN may read the rules of main, and CONSOLE_FORGE_ADAPTER and CONSOLE_FORGE_URL$/,
      );
    },
  );
});

import { scenario } from "@opensoftware/testkit";
import { signInEnv } from "./signin.ts";

scenario("SCN-CONSOLE-150", async ({ sut, fakes, given, when, then }) => {
  let env: Record<string, string> = {};
  await given(
    'a console that signs in with OpenID Connect and has "CONSOLE_USER_HEADER" "X-Forwarded-Email"',
    async () => {
      env = (await signInEnv(sut, fakes)).env;
      env.CONSOLE_USER_HEADER = "X-Forwarded-Email";
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "console serve"', async () => {
    run = await sut.cli(["serve"], { env });
  });

  await then("the command exits with code 2", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(2);
  });

  await then('it prints "set either CONSOLE_SIGN_IN or CONSOLE_USER_HEADER"', async () => {
    expect(run.stderr).toContain("set either CONSOLE_SIGN_IN or CONSOLE_USER_HEADER");
  });
});

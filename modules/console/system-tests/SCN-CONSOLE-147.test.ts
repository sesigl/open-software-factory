import { scenario } from "@opensoftware/testkit";
import { signInEnv } from "./signin.ts";

scenario("SCN-CONSOLE-147", async ({ sut, fakes, given, when, then }) => {
  let env: Record<string, string> = {};
  await given('a console that signs in with OpenID Connect without "CONSOLE_OIDC_CLIENT_SECRET"', async () => {
    env = (await signInEnv(sut, fakes)).env;
    delete env.CONSOLE_OIDC_CLIENT_SECRET;
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "console serve"', async () => {
    run = await sut.cli(["serve"], { env });
  });

  await then("the command exits with code 2", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(2);
  });

  await then('it prints "set CONSOLE_OIDC_CLIENT_SECRET: CONSOLE_SIGN_IN=oidc needs it"', async () => {
    expect(run.stderr).toContain("set CONSOLE_OIDC_CLIENT_SECRET: CONSOLE_SIGN_IN=oidc needs it");
  });
});

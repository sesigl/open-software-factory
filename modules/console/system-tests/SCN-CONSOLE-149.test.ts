import { scenario } from "@opensoftware/testkit";
import { signInEnv } from "./signin.ts";

scenario("SCN-CONSOLE-149", async ({ sut, fakes, given, when, then }) => {
  let env: Record<string, string> = {};
  await given('a console that signs in with OpenID Connect at "CONSOLE_URL" "http://console.acme.dev"', async () => {
    env = (await signInEnv(sut, fakes)).env;
    env.CONSOLE_URL = "http://console.acme.dev";
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "console serve"', async () => {
    run = await sut.cli(["serve"], { env });
  });

  await then("the command exits with code 2", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(2);
  });

  await then('it prints "CONSOLE_URL http://console.acme.dev is neither https:// nor loopback"', async () => {
    expect(run.stderr).toContain("CONSOLE_URL http://console.acme.dev is neither https:// nor loopback");
  });
});

import { scenario } from "@opensoftware/testkit";
import { healthyServer, TOKEN_ROUTES } from "./console.ts";
import { signInEnv } from "./signin.ts";

scenario("SCN-CONSOLE-169", async ({ sut, fakes, given, when, then }) => {
  let env: Record<string, string> = {};
  await given(
    'a console that signs in with GitHub, with "CONSOLE_OIDC_ISSUER" still set, and an access file with "admin@example.com" and "ada@acme.dev" as "admin"',
    async () => {
      const setup = await signInEnv(sut, fakes, { "admin@example.com": "admin", "ada@acme.dev": "admin" });
      const foreman = await healthyServer(fakes, [], TOKEN_ROUTES.foreman);
      env = { ...setup.env, CONSOLE_FOREMAN_URL: foreman.url, CONSOLE_SIGN_IN: "github" };
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "console doctor"', async () => {
    run = await sut.cli(["doctor"], { env });
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then('it prints "ok    access"', async () => {
    expect(run.stdout).toContain("ok    access\n");
  });

  await then("it prints no line about the sign-in", async () => {
    expect(run.stdout).not.toContain("sign-in");
  });
});

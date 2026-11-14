import { scenario } from "@opensoftware/testkit";
import { healthyServer, TOKEN_ROUTES } from "./console.ts";
import { signInEnv } from "./signin.ts";

scenario("SCN-CONSOLE-170", async ({ sut, fakes, given, when, then }) => {
  let env: Record<string, string> = {};
  await given(
    'a console that signs in with OpenID Connect at a provider that answers, with a slash at the end of "CONSOLE_OIDC_ISSUER"',
    async () => {
      const setup = await signInEnv(sut, fakes);
      const foreman = await healthyServer(fakes, [], TOKEN_ROUTES.foreman);
      env = { ...setup.env, CONSOLE_FOREMAN_URL: foreman.url, CONSOLE_OIDC_ISSUER: `${setup.oidc.url}/` };
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "console doctor"', async () => {
    run = await sut.cli(["doctor"], { env });
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then('it prints "ok    sign-in"', async () => {
    expect(run.stdout).toContain("ok    sign-in\n");
  });
});

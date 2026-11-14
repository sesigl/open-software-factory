import { scenario } from "@opensoftware/testkit";
import { healthyServer, TOKEN_ROUTES } from "./console.ts";
import { signInEnv } from "./signin.ts";

scenario("SCN-CONSOLE-168", async ({ sut, fakes, given, when, then }) => {
  let env: Record<string, string> = {};
  await given(
    'a console that signs in with OpenID Connect at "http://127.0.0.1:1", where nothing listens, and an access file with "ada@acme.dev" as "admin"',
    async () => {
      const setup = await signInEnv(sut, fakes);
      const foreman = await healthyServer(fakes, [], TOKEN_ROUTES.foreman);
      env = { ...setup.env, CONSOLE_FOREMAN_URL: foreman.url, CONSOLE_OIDC_ISSUER: "http://127.0.0.1:1" };
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "console doctor"', async () => {
    run = await sut.cli(["doctor"], { env });
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then(
    'it prints "FAIL  sign-in: the provider at http://127.0.0.1:1 did not answer its discovery: check CONSOLE_OIDC_ISSUER"',
    async () => {
      expect(run.stdout).toContain(
        "FAIL  sign-in: the provider at http://127.0.0.1:1 did not answer its discovery: check CONSOLE_OIDC_ISSUER\n",
      );
    },
  );

  await then('it prints "ok    access"', async () => {
    expect(run.stdout).toContain("ok    access\n");
  });
});

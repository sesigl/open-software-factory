import { scenario } from "@opensoftware/testkit";
import { healthyServer, TOKEN_ROUTES } from "./console.ts";
import { signInEnv } from "./signin.ts";

scenario("SCN-CONSOLE-167", async ({ sut, fakes, given, when, then }) => {
  let env: Record<string, string> = {};
  await given(
    'a console that signs in with OpenID Connect at a provider that answers, and an access file with "admin@example.com" as "admin" and "ada@acme.dev" as "member"',
    async () => {
      const setup = await signInEnv(sut, fakes, { "admin@example.com": "admin", "ada@acme.dev": "member" });
      const foreman = await healthyServer(fakes, [], TOKEN_ROUTES.foreman);
      env = { ...setup.env, CONSOLE_FOREMAN_URL: foreman.url };
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "console doctor"', async () => {
    run = await sut.cli(["doctor"], { env });
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then('it prints "ok    sign-in"', async () => {
    expect(run.stdout).toContain("ok    sign-in\n");
  });

  await then(
    'it prints "FAIL  access: <access file> has no admin but the example\'s admin@example.com: put your admins in <access file>"',
    async () => {
      const file = sut.files.path("$INPUT/access.yaml");
      expect(run.stdout).toContain(
        `FAIL  access: ${file} has no admin but the example's admin@example.com: put your admins in ${file}\n`,
      );
    },
  );
});

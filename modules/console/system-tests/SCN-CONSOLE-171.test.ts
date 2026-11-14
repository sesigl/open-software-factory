import { scenario } from "@opensoftware/testkit";
import { healthyServer, TOKEN_ROUTES } from "./console.ts";
import { signInEnv } from "./signin.ts";

scenario("SCN-CONSOLE-171", async ({ sut, fakes, given, when, then }) => {
  let env: Record<string, string> = {};
  await given(
    'a console that signs in with OpenID Connect at a provider that answers, and an access file with "ada@acme.dev" as "member"',
    async () => {
      const setup = await signInEnv(sut, fakes, { "ada@acme.dev": "member" });
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

  await then(
    'it prints "FAIL  access: <access file>: no person has the role admin: check CONSOLE_ACCESS"',
    async () => {
      const file = sut.files.path("$INPUT/access.yaml");
      expect(run.stdout).toContain(`FAIL  access: ${file}: no person has the role admin: check CONSOLE_ACCESS\n`);
    },
  );
});

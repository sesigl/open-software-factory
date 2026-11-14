import { scenario } from "@opensoftware/testkit";
import { COMPOSE, DOCKER_LOG, ENV, fakeDocker, REQUIRES_PASSWORD } from "./setup.ts";

scenario("SCN-REPO-157", async ({ sut, given, when, then }) => {
  await given(
    'a "deploy/compose/compose.yaml" that requires "POSTGRES_PASSWORD" with "${POSTGRES_PASSWORD:?...}"',
    async () => {
      await sut.files.put(`$INPUT/${COMPOSE}`, REQUIRES_PASSWORD);
    },
  );

  let env: Record<string, string> = {};
  await given("a fake docker that logs its arguments", async () => {
    env = await fakeDocker(sut);
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when(
    'the developer runs "osf up" with a ".env" that sets "CONSOLE_SIGN_IN=oidc" and "CONSOLE_OIDC_ISSUER", but not the client\'s ID and secret',
    async () => {
      await sut.files.put(
        `$INPUT/${ENV}`,
        [
          "POSTGRES_PASSWORD=postgres-password-1",
          "GATEKEEPER_FORGE_TOKEN=forge-token-1",
          "CONSOLE_SESSION_SECRET=testkit-session-key-1",
          "CONSOLE_SIGN_IN=oidc",
          "CONSOLE_OIDC_ISSUER=https://accounts.google.com",
          "CONSOLE_OIDC_CLIENT_ID=",
          "",
        ].join("\n"),
      );
      run = await sut.cli(["up"], { env });
    },
  );

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then(
    'the output contains "set CONSOLE_OIDC_CLIENT_ID in deploy/compose/.env: CONSOLE_SIGN_IN=oidc needs it"',
    async () => {
      expect(run.stdout).toContain(
        "set CONSOLE_OIDC_CLIENT_ID in deploy/compose/.env: CONSOLE_SIGN_IN=oidc needs it\n",
      );
    },
  );

  await then(
    'the output contains "set CONSOLE_OIDC_CLIENT_SECRET in deploy/compose/.env: CONSOLE_SIGN_IN=oidc needs it"',
    async () => {
      expect(run.stdout).toContain(
        "set CONSOLE_OIDC_CLIENT_SECRET in deploy/compose/.env: CONSOLE_SIGN_IN=oidc needs it\n",
      );
      expect(run.stdout.trim().split("\n")).toEqual([
        "set CONSOLE_OIDC_CLIENT_ID in deploy/compose/.env: CONSOLE_SIGN_IN=oidc needs it",
        "set CONSOLE_OIDC_CLIENT_SECRET in deploy/compose/.env: CONSOLE_SIGN_IN=oidc needs it",
      ]);
    },
  );

  await then("the fake docker was not called", async () => {
    expect(await sut.files.list("$OUTPUT")).not.toContain(DOCKER_LOG.replace("$OUTPUT/", ""));
  });
});

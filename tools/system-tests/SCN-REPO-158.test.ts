import { scenario } from "@opensoftware/testkit";
import { COMPOSE, DOCKER_LOG, ENV, fakeDocker, REQUIRES_PASSWORD } from "./setup.ts";

/** A .env with the profile's own values and this sign-in. */
const envWith = (signIn: string) =>
  `POSTGRES_PASSWORD=postgres-password-1\nGATEKEEPER_FORGE_TOKEN=forge-token-1\nCONSOLE_SIGN_IN=${signIn}\n`;

scenario("SCN-REPO-158", async ({ sut, given, when, then }) => {
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

  let runs: Awaited<ReturnType<typeof sut.cli>>[] = [];
  await when(
    'the developer runs "osf up" with "CONSOLE_SIGN_IN=github" and no other setting of the sign-in, and again with "CONSOLE_SIGN_IN=saml"',
    async () => {
      await sut.files.put(`$INPUT/${ENV}`, envWith("github"));
      const github = await sut.cli(["up"], { env });
      await sut.files.put(`$INPUT/${ENV}`, envWith("saml"));
      runs = [github, await sut.cli(["up"], { env })];
    },
  );

  await then(
    'the first run prints only "set CONSOLE_SESSION_SECRET in deploy/compose/.env: CONSOLE_SIGN_IN=github needs it" and the same for "CONSOLE_GITHUB_CLIENT_ID" and "CONSOLE_GITHUB_CLIENT_SECRET"',
    async () => {
      expect(runs[0]?.stdout.trim().split("\n")).toEqual(
        ["CONSOLE_SESSION_SECRET", "CONSOLE_GITHUB_CLIENT_ID", "CONSOLE_GITHUB_CLIENT_SECRET"].map(
          (name) => `set ${name} in deploy/compose/.env: CONSOLE_SIGN_IN=github needs it`,
        ),
      );
    },
  );

  await then(
    'the second run prints only "set CONSOLE_SIGN_IN in deploy/compose/.env to oidc or github, not saml"',
    async () => {
      expect(runs[1]?.stdout.trim()).toBe("set CONSOLE_SIGN_IN in deploy/compose/.env to oidc or github, not saml");
    },
  );

  await then("both exit with code 1 and the fake docker was not called", async () => {
    expect(runs.map((run) => run.exitCode)).toEqual([1, 1]);
    expect(await sut.files.list("$OUTPUT")).not.toContain(DOCKER_LOG.replace("$OUTPUT/", ""));
  });
});

import { scenario } from "@opensoftware/testkit";
import { COMPOSE, DOCKER_LOG, ENV, fakeDocker, REQUIRES_PASSWORD } from "./setup.ts";

scenario("SCN-REPO-135", async ({ sut, given, when, then }) => {
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
  await when('the developer runs "osf up" without a "deploy/compose/.env"', async () => {
    run = await sut.cli(["up"], { env });
  });

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then('the output contains "deploy/compose/.env is missing: run osf init"', async () => {
    expect(run.stdout).toContain("deploy/compose/.env is missing: run osf init");
  });

  await when(
    'the developer runs "osf up" with a ".env" whose "POSTGRES_PASSWORD" and gatekeeper values are empty',
    async () => {
      await sut.files.put(
        `$INPUT/${ENV}`,
        "POSTGRES_PASSWORD=\nGATEKEEPER_SLACK_CHANNEL=#approvals\nGATEKEEPER_SLACK_TOKEN=\nGATEKEEPER_FORGE_TOKEN=\n",
      );
      run = await sut.cli(["up"], { env });
    },
  );

  await then("the command exits with code 1", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(1);
  });

  await then('the output contains "set POSTGRES_PASSWORD in deploy/compose/.env"', async () => {
    expect(run.stdout).toContain("set POSTGRES_PASSWORD in deploy/compose/.env");
  });

  await then(
    'the output contains "set GATEKEEPER_SLACK_CHANNEL, GATEKEEPER_SLACK_TOKEN and GATEKEEPER_SLACK_SIGNING_SECRET, or GATEKEEPER_FORGE_TOKEN, in deploy/compose/.env"',
    async () => {
      expect(run.stdout).toContain(
        "set GATEKEEPER_SLACK_CHANNEL, GATEKEEPER_SLACK_TOKEN and GATEKEEPER_SLACK_SIGNING_SECRET, or GATEKEEPER_FORGE_TOKEN, in deploy/compose/.env",
      );
    },
  );

  await then("the fake docker was not called", async () => {
    expect(await sut.files.list("$OUTPUT")).not.toContain(DOCKER_LOG.replace("$OUTPUT/", ""));
  });
});

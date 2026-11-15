import { scenario } from "@opensoftware/testkit";
import { COMPOSE, DOCKER_LOG, ENV, fakeDocker, REQUIRES_PASSWORD } from "./setup.ts";

/** A .env with the profile's own values and these lines. */
const envWith = (...lines: string[]) =>
  ["POSTGRES_PASSWORD=postgres-password-1", "GATEKEEPER_FORGE_TOKEN=forge-token-1", ...lines, ""].join("\n");

scenario("SCN-REPO-169", async ({ sut, given, when, then }) => {
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
    'the developer runs "osf up" with "FACTORY_REPOSITORY=git+https://github.com/acme/factory.git#main" and no "FACTORY_TOKEN" or "FACTORY_USER", and again with "FACTORY_REPOSITORY=https://github.com/acme/factory.git" and both set',
    async () => {
      await sut.files.put(
        `$INPUT/${ENV}`,
        envWith("FACTORY_REPOSITORY=git+https://github.com/acme/factory.git#main", "FACTORY_TOKEN="),
      );
      const missing = await sut.cli(["up"], { env });
      await sut.files.put(
        `$INPUT/${ENV}`,
        envWith(
          "FACTORY_REPOSITORY=https://github.com/acme/factory.git",
          "FACTORY_TOKEN=factory-token-1",
          "FACTORY_USER=github:acme-factory",
        ),
      );
      runs = [missing, await sut.cli(["up"], { env })];
    },
  );

  await then(
    'the first run prints only "set FACTORY_TOKEN in deploy/compose/.env: FACTORY_REPOSITORY needs it" and the same for "FACTORY_USER"',
    async () => {
      expect(runs[0]?.stdout.trim().split("\n")).toEqual(
        ["FACTORY_TOKEN", "FACTORY_USER"].map(
          (name) => `set ${name} in deploy/compose/.env: FACTORY_REPOSITORY needs it`,
        ),
      );
    },
  );

  await then(
    'the second run prints only "set FACTORY_REPOSITORY in deploy/compose/.env to git+<url>#<branch>, like git+https://github.com/acme/factory.git#main, not https://github.com/acme/factory.git"',
    async () => {
      expect(runs[1]?.stdout.trim()).toBe(
        "set FACTORY_REPOSITORY in deploy/compose/.env to git+<url>#<branch>, like git+https://github.com/acme/factory.git#main, not https://github.com/acme/factory.git",
      );
    },
  );

  await then("both exit with code 1 and the fake docker was not called", async () => {
    expect(runs.map((run) => run.exitCode)).toEqual([1, 1]);
    expect(await sut.files.list("$OUTPUT")).not.toContain(DOCKER_LOG.replace("$OUTPUT/", ""));
  });
});

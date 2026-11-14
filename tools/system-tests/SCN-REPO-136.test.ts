import { scenario } from "@opensoftware/testkit";
import { COMPOSE, dockerCalls, ENV, fakeDocker, REQUIRES_PASSWORD } from "./setup.ts";

scenario("SCN-REPO-136", async ({ sut, given, when, then }) => {
  await given(
    'a "deploy/compose/compose.yaml" that requires "POSTGRES_PASSWORD" with "${POSTGRES_PASSWORD:?...}"',
    async () => {
      await sut.files.put(`$INPUT/${COMPOSE}`, REQUIRES_PASSWORD);
    },
  );

  await given('a "deploy/compose/.env" with "POSTGRES_PASSWORD" and "GATEKEEPER_FORGE_TOKEN" set', async () => {
    await sut.files.put(
      `$INPUT/${ENV}`,
      "POSTGRES_PASSWORD=pw\nGATEKEEPER_FORGE_TOKEN=forge\nGATEKEEPER_SLACK_TOKEN=\n",
    );
  });

  let env: Record<string, string> = {};
  await given("a fake docker that logs its arguments and its folder", async () => {
    env = await fakeDocker(sut);
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the developer runs "osf up"', async () => {
    run = await sut.cli(["up"], { env });
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then('the fake docker ran "compose up --detach --wait" in "deploy/compose"', async () => {
    expect(await dockerCalls(sut)).toEqual(["deploy/compose|compose up --detach --wait"]);
  });
});

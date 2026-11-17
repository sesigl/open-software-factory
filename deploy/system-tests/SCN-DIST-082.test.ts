import { type CliResult, type Compose, scenario } from "@opensoftware/testkit";
import { GATEKEEPER_SIGNING_KEY, profile, words } from "./profile.ts";

type Services = Record<string, { environment?: Record<string, string | null> }>;

scenario("SCN-DIST-082", async ({ sut, given, when, then }) => {
  let compose: Compose;
  await given(
    'the Compose profile with every value of ".env.example" set in ".env", "GATEKEEPER_SIGNING_KEY" among them',
    async () => {
      compose = await profile(sut);
    },
  );

  let services: Services = {};
  await when('the operator runs "docker compose --profile tools config --format json"', async () => {
    const result = await compose.run(words("docker compose --profile tools config --format json"));
    expect(result.exitCode, result.stderr).toBe(0);
    services = (JSON.parse(result.stdout) as { services: Services }).services;
  });

  await then(
    'the service "gatekeeper" sets "GATEKEEPER_SIGNING_KEY" to the key of ".env", and no other service gets the key',
    async () => {
      expect(services.gatekeeper?.environment?.GATEKEEPER_SIGNING_KEY).toBe(GATEKEEPER_SIGNING_KEY);
      const holders = Object.keys(services).filter((service) =>
        Object.values(services[service]?.environment ?? {}).some((value) => value?.includes(GATEKEEPER_SIGNING_KEY)),
      );
      expect(holders).toEqual(["gatekeeper"]);
    },
  );

  let up: CliResult;
  await when(
    'the operator runs "docker compose up --detach --wait" with every value of ".env.example" set in ".env" except "GATEKEEPER_SIGNING_KEY"',
    async () => {
      const without = await profile(sut, "GATEKEEPER_SIGNING_KEY");
      up = await without.run(words("docker compose up --detach --wait"));
    },
  );

  await then("the command exits with code 1", async () => {
    expect(up.exitCode, up.stderr).toBe(1);
  });

  await then('the output contains "set GATEKEEPER_SIGNING_KEY in .env"', async () => {
    expect(up.stdout + up.stderr).toContain("set GATEKEEPER_SIGNING_KEY in .env");
  });
});

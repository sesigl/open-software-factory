import { type Compose, scenario } from "@opensoftware/testkit";
import { profile } from "./profile.ts";

type Services = Record<string, { environment?: Record<string, string | null> }>;

const HOOKS = ["OSF_NOW", "OSF_SEED", "OSF_TEST_HOOKS"];

scenario("SCN-DIST-072", async ({ sut, given, when, then }) => {
  let compose: Compose;
  await given('the Compose profile with every value of ".env.example" set in ".env"', async () => {
    compose = await profile(sut);
  });

  let services: Services = {};
  await when('the operator runs "docker compose --profile tools config --format json"', async () => {
    const result = await compose.run(["--profile", "tools", "config", "--format", "json"]);
    expect(result.exitCode, result.stderr).toBe(0);
    services = (JSON.parse(result.stdout) as { services: Services }).services;
  });

  await then('no service sets "OSF_NOW", "OSF_SEED" or "OSF_TEST_HOOKS"', async () => {
    expect(Object.keys(services)).toContain("gatekeeper");
    const set = Object.entries(services).flatMap(([service, { environment = {} }]) =>
      HOOKS.filter((name) => name in environment).map((name) => `${service}: ${name}`),
    );
    expect(set).toEqual([]);
  });
});

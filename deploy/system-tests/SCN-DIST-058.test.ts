import { type Compose, scenario } from "@opensoftware/testkit";
import { profile, words } from "./profile.ts";

type Services = Record<string, { environment?: Record<string, string | null> }>;

scenario("SCN-DIST-058", async ({ sut, given, when, then }) => {
  let compose: Compose;
  await given('the Compose profile with every value of ".env.example" set in ".env"', async () => {
    compose = await profile(sut);
  });

  let services: Services = {};
  await when('the operator runs "docker compose config --format json"', async () => {
    const result = await compose.run(words("docker compose config --format json"));
    expect(result.exitCode, result.stderr).toBe(0);
    services = (JSON.parse(result.stdout) as { services: Services }).services;
  });

  await then(
    'the service "foreman" sets "FOREMAN_SANDBOX_OWNER" to the name of the project, which its "OSF_SANDBOX_NETWORK" starts with',
    async () => {
      const environment = services.foreman?.environment ?? {};
      expect(environment.FOREMAN_SANDBOX_OWNER).toMatch(/^[a-z0-9][a-z0-9_-]*$/);
      expect(environment.OSF_SANDBOX_NETWORK).toBe(`${environment.FOREMAN_SANDBOX_OWNER}_default`);
    },
  );
});

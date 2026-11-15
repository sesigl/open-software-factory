import { type Compose, scenario } from "@opensoftware/testkit";
import { profile, words } from "./profile.ts";

/** The console's sign-in with GitHub and its signing key, made up for the test: no GitHub issued the app. */
const SIGN_IN = {
  CONSOLE_SIGN_IN: "github",
  CONSOLE_SESSION_SECRET: "console-session-secret-1",
  CONSOLE_GITHUB_CLIENT_ID: "Iv1.acme0console",
  CONSOLE_GITHUB_CLIENT_SECRET: "github-oauth-secret-1",
  CONSOLE_SIGNING_KEY: "0123456789abcdef".repeat(4),
};
const KEYS = "console=http://console:8080/.well-known/jwks.json";
const MODULES = { foreman: "FOREMAN_PERSON_KEYS", intake: "INTAKE_PERSON_KEYS", gatekeeper: "GATEKEEPER_PERSON_KEYS" };

type Services = Record<string, { environment?: Record<string, string | null> }>;

scenario("SCN-DIST-046", async ({ sut, given, when, then }) => {
  /** The services of "docker compose config --format json" of the profile. */
  const config = async (compose: Compose): Promise<Services> => {
    const result = await compose.run(["--profile", "tools", ...words("docker compose config --format json")]);
    expect(result.exitCode, result.stderr).toBe(0);
    return (JSON.parse(result.stdout) as { services: Services }).services;
  };
  /** The setting of each module that names the issuers of person proofs. */
  const personKeys = (services: Services) =>
    Object.fromEntries(
      Object.entries(MODULES).map(([service, name]) => [name, services[service]?.environment?.[name]]),
    );

  let compose: Compose;
  await given(
    'the Compose profile with every value of ".env.example" set in ".env", "CONSOLE_SIGN_IN" set to "github" with its settings, and "CONSOLE_SIGNING_KEY" set',
    async () => {
      compose = await profile(sut, undefined, SIGN_IN);
    },
  );

  let services: Services = {};
  await when('the operator runs "docker compose config --format json"', async () => {
    services = await config(compose);
  });

  await then(
    'the service "console" sets "CONSOLE_SIGNING_KEY" to the key, and no other service gets the key',
    async () => {
      expect(services.console?.environment?.CONSOLE_SIGNING_KEY).toBe(SIGN_IN.CONSOLE_SIGNING_KEY);
      const holders = Object.keys(services).filter((service) =>
        Object.values(services[service]?.environment ?? {}).some((value) =>
          value?.includes(SIGN_IN.CONSOLE_SIGNING_KEY),
        ),
      );
      expect(holders).toEqual(["console"]);
    },
  );

  await then(
    'the services "foreman", "intake" and "gatekeeper" set "FOREMAN_PERSON_KEYS", "INTAKE_PERSON_KEYS" and "GATEKEEPER_PERSON_KEYS" to "console=http://console:8080/.well-known/jwks.json"',
    async () => {
      expect(personKeys(services)).toEqual({
        FOREMAN_PERSON_KEYS: KEYS,
        INTAKE_PERSON_KEYS: KEYS,
        GATEKEEPER_PERSON_KEYS: KEYS,
      });
    },
  );

  let without: Services[] = [];
  await when(
    'the operator runs it again without "CONSOLE_SIGNING_KEY", and again with the key and without "CONSOLE_SIGN_IN"',
    async () => {
      // One after the other: each writes the scenario's .env.
      without = [
        await config(await profile(sut, "CONSOLE_SIGNING_KEY", SIGN_IN)),
        await config(await profile(sut, "CONSOLE_SIGN_IN", SIGN_IN)),
      ];
    },
  );

  await then(
    "both times the three settings of the modules are empty, so the modules take the person a caller names, as before",
    async () => {
      const empty = { FOREMAN_PERSON_KEYS: "", INTAKE_PERSON_KEYS: "", GATEKEEPER_PERSON_KEYS: "" };
      expect(without.map(personKeys)).toEqual([empty, empty]);
    },
  );
});

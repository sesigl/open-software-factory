import { scenario } from "@opensoftware/testkit";
import { profile, words } from "./profile.ts";

/** A factory repository on Forgejo and its token, made up for the test: no forge issued it. */
const SETTINGS = {
  FACTORY_REPOSITORY: "git+https://codeberg.org/acme/factory.git#main",
  FACTORY_TOKEN: "factory-token-1",
  FACTORY_USER: "forgejo:factory-bot",
  FACTORY_FORGE_ADAPTER: "forge-forgejo",
  FACTORY_FORGE_URL: "https://codeberg.org",
};

type Services = Record<string, { environment?: Record<string, string | null> }>;

scenario("SCN-DIST-044", async ({ sut, given, when, then }) => {
  let compose: Awaited<ReturnType<typeof profile>>;
  await given(
    'the Compose profile with every value of ".env.example" set in ".env", and "FACTORY_REPOSITORY", "FACTORY_TOKEN", "FACTORY_USER", "FACTORY_FORGE_ADAPTER" and "FACTORY_FORGE_URL" set for a repository on Forgejo',
    async () => {
      compose = await profile(sut, undefined, SETTINGS);
    },
  );

  let services: Services = {};
  await when('the operator runs "docker compose config --format json"', async () => {
    const config = await compose.run(["--profile", "tools", ...words("docker compose config --format json")]);
    expect(config.exitCode, config.stderr).toBe(0);
    services = (JSON.parse(config.stdout) as { services: Services }).services;
  });

  const environment = (service: string) => services[service]?.environment ?? {};

  await then(
    'the service "foreman" sets "FOREMAN_FACTORY" to the repository and "FOREMAN_FACTORY_TOKEN" to the token',
    async () => {
      expect(environment("foreman")).toMatchObject({
        FOREMAN_FACTORY: SETTINGS.FACTORY_REPOSITORY,
        FOREMAN_FACTORY_TOKEN: SETTINGS.FACTORY_TOKEN,
      });
    },
  );

  await then(
    'the service "console" sets "CONSOLE_FACTORY_REPOSITORY", "CONSOLE_FACTORY_TOKEN", "CONSOLE_FACTORY_USER", "CONSOLE_FORGE_ADAPTER" and "CONSOLE_FORGE_URL" to the values, and "CONSOLE_FACTORY_COMMAND" to "factory"',
    async () => {
      expect(environment("console")).toMatchObject({
        CONSOLE_FACTORY_REPOSITORY: SETTINGS.FACTORY_REPOSITORY,
        CONSOLE_FACTORY_TOKEN: SETTINGS.FACTORY_TOKEN,
        CONSOLE_FACTORY_USER: SETTINGS.FACTORY_USER,
        CONSOLE_FORGE_ADAPTER: SETTINGS.FACTORY_FORGE_ADAPTER,
        CONSOLE_FORGE_URL: SETTINGS.FACTORY_FORGE_URL,
        CONSOLE_FACTORY_COMMAND: "factory",
      });
    },
  );

  await then('no service but "factory-repo", "foreman" and "console" gets the token', async () => {
    const holders = Object.keys(services).filter((service) =>
      Object.values(environment(service)).some((value) => value?.includes(SETTINGS.FACTORY_TOKEN)),
    );
    expect(holders.sort()).toEqual(["console", "factory-repo", "foreman"]);
  });

  await then('"factory --help" runs in the service "console" and names the command "edit"', async () => {
    const help = await compose.run(["run", "--rm", "--no-deps", "-T", "--entrypoint", "factory", "console", "--help"]);
    expect(help.exitCode, help.stderr).toBe(0);
    expect(help.stdout).toMatch(/^ {2}factory edit /m);
  });
});

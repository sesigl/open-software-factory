import { scenario } from "@opensoftware/testkit";
import { profile, words } from "./profile.ts";

scenario("SCN-DIST-013", async ({ sut, given, when, then }) => {
  let compose: Awaited<ReturnType<typeof profile>>;
  await given('the Compose profile with every value of ".env.example" set in ".env"', async () => {
    compose = await profile(sut);
  });

  let config: Awaited<ReturnType<typeof compose.run>>;
  await when('the operator runs "docker compose config --images"', async () => {
    config = await compose.run(words("docker compose config --images"));
  });

  await then("the command exits with code 0", async () => {
    expect(config.exitCode, config.stderr).toBe(0);
  });

  await then(
    'the output lists the images "gatekeeper", "intake", "foreman", "console" and "factory-spec" as "ghcr.io/sesigl/open-software-factory/<name>:<version>"',
    async () => {
      const names = config.stdout
        .split("\n")
        .map((line) => /^ghcr\.io\/sesigl\/open-software-factory\/([a-z-]+):\d+\.\d+\.\d+(-r\d+)?$/.exec(line.trim()))
        .flatMap((match) => (match ? [match[1]] : []));
      expect(names.sort()).toEqual(["console", "factory-spec", "foreman", "gatekeeper", "intake"]);
    },
  );
});

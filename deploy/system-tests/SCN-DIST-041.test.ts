import { scenario } from "@opensoftware/testkit";
import { profile, words } from "./profile.ts";

scenario("SCN-DIST-041", async ({ sut, given, when, then }) => {
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

  const images = () => config.stdout.split("\n").map((line) => line.trim());

  await then(
    'the output lists the images "gatekeeper", "intake", "foreman", "console", "factory-spec", "harness-claude-code" and "litellm" as "ghcr.io/sesigl/open-software-factory/<name>:<version>", "console" twice: for "console" and for the job "openbao-policies"',
    async () => {
      const names = images()
        .map((line) => /^ghcr\.io\/sesigl\/open-software-factory\/([a-z-]+):\d+\.\d+\.\d+(-r\d+)?$/.exec(line))
        .flatMap((match) => (match ? [match[1]] : []));
      expect(names.sort()).toEqual([
        "console",
        "console",
        "factory-spec",
        "foreman",
        "gatekeeper",
        "harness-claude-code",
        "intake",
        "litellm",
      ]);
    },
  );

  await then(
    'the output lists "quay.io/openbao/openbao:2.7.2" twice: for "openbao" and for the job "openbao-setup"',
    async () => {
      expect(images().filter((line) => line.includes("openbao/"))).toEqual([
        "quay.io/openbao/openbao:2.7.2",
        "quay.io/openbao/openbao:2.7.2",
      ]);
    },
  );
});

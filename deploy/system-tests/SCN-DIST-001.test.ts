import { scenario } from "@opensoftware/testkit";
import { profile, words } from "./profile.ts";

scenario("SCN-DIST-001", async ({ sut, given, when, then }) => {
  let compose: Awaited<ReturnType<typeof profile>>;
  await given('the Compose profile with every value of ".env.example" set in ".env"', async () => {
    compose = await profile(sut);
  });

  let up: Awaited<ReturnType<typeof compose.run>>;
  await when('the operator runs "docker compose up --detach --wait"', async () => {
    up = await compose.run(words("docker compose up --detach --wait"));
  });

  await then("the command exits with code 0", async () => {
    expect(up.exitCode, up.stderr).toBe(0);
  });

  await then(
    'the services "postgres", "temporal", "temporal-ui", "nats", "seaweedfs", "phoenix", "litellm", "gatekeeper", "intake", "foreman" and "console" are running and healthy',
    async () => {
      const names = ["postgres", "temporal", "temporal-ui", "nats", "seaweedfs", "phoenix", "litellm"];
      names.push("gatekeeper", "intake", "foreman", "console");
      const services = await compose.services();
      expect(
        names.map((name) => {
          const service = services.find((candidate) => candidate.service === name);
          return { name, state: service?.state, health: service?.health };
        }),
      ).toEqual(names.map((name) => ({ name, state: "running", health: "healthy" })));
    },
  );

  await then('the services "temporal-schema", "temporal-namespace" and "factory-repo" exited with code 0', async () => {
    const names = ["temporal-schema", "temporal-namespace", "factory-repo"];
    const services = await compose.services();
    expect(
      names.map((name) => {
        const service = services.find((candidate) => candidate.service === name);
        return { name, state: service?.state, exitCode: service?.exitCode };
      }),
    ).toEqual(names.map((name) => ({ name, state: "exited", exitCode: 0 })));
  });
});

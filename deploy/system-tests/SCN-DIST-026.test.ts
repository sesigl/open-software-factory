import { scenario } from "@opensoftware/testkit";
import { operatorFactory, profile, words } from "./profile.ts";

scenario("SCN-DIST-026", async ({ sut, fakes, given, when, then }) => {
  let compose: Awaited<ReturnType<typeof profile>>;
  await given('the Compose profile with every value of ".env.example" set in ".env"', async () => {
    // FACTORY_DIR is a value of ".env.example": the operator's copy names a real approver (ADR 0114).
    compose = await profile(sut, undefined, { FACTORY_DIR: await operatorFactory(sut, fakes) });
  });

  let up: Awaited<ReturnType<typeof compose.run>>;
  await when('the operator runs "docker compose up --detach --wait"', async () => {
    up = await compose.run(words("docker compose up --detach --wait"));
  });

  await then("the command exits with code 0", async () => {
    expect(up.exitCode, up.stderr).toBe(0);
  });

  await then(
    'the services "postgres", "temporal", "temporal-ui", "nats", "jaeger", "litellm", "gatekeeper", "intake", "foreman" and "console" are running and healthy',
    async () => {
      const names = ["postgres", "temporal", "temporal-ui", "nats", "jaeger", "litellm"];
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

  await then('"/v1/health" of "intake", "gatekeeper" and "foreman" answers 200 with the status "ok"', async () => {
    const intake = await fetch(`${await compose.url("intake", 8080)}/v1/health`);
    const gatekeeper = await fetch(`${await compose.url("gatekeeper", 8080)}/v1/health`);
    const foreman = await fetch(`${await compose.url("foreman", 8080)}/v1/health`);
    expect([intake.status, gatekeeper.status, foreman.status]).toEqual([200, 200, 200]);
    const bodies = await Promise.all([intake.json(), gatekeeper.json(), foreman.json()]);
    expect(bodies.map((body) => (body as { status?: string }).status)).toEqual(["ok", "ok", "ok"]);
  });

  await then(
    '"docker compose run --rm console console doctor" exits with code 0 and prints no line that starts with "FAIL"',
    async () => {
      const doctor = await compose.run(words("docker compose run --rm console console doctor"));
      expect(doctor.exitCode, doctor.stdout + doctor.stderr).toBe(0);
      expect(doctor.stdout.split("\n").filter((line) => line.startsWith("FAIL"))).toEqual([]);
    },
  );
});

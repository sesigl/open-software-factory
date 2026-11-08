import { type Health, healthOf, type Probe } from "@opensoftware/cli";
import { scenario } from "@opensoftware/testkit";

scenario("SCN-CLI-017", async ({ given, when, then }) => {
  let probes: Probe[] = [];
  await given('the probes "database" and "nats" that both answer', async () => {
    probes = ["database", "nats"].map((name) => ({ name, check: async () => {}, fix: `check ${name}` }));
  });

  let health: Health;
  await when("the module asks for its health", async () => {
    health = await healthOf(probes);
  });

  await then('it gets the status "ok" with the checks "database" and "nats" ok and no detail', async () => {
    expect(health).toEqual({
      status: "ok",
      checks: [
        { name: "database", ok: true },
        { name: "nats", ok: true },
      ],
    });
  });
});

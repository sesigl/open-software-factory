import { type Health, healthOf, type Probe } from "@opensoftware/cli";
import { scenario } from "@opensoftware/testkit";

scenario("SCN-CLI-019", async ({ given, when, then }) => {
  let probes: Probe[] = [];
  await given('the probe "temporal" that never answers, with the fix "check FOREMAN_TEMPORAL_ADDRESS"', async () => {
    probes = [{ name: "temporal", check: () => new Promise(() => {}), fix: "check FOREMAN_TEMPORAL_ADDRESS" }];
  });

  let health: Health;
  let tookMs = 0;
  await when("the module asks for its health", async () => {
    const started = Date.now();
    health = await healthOf(probes);
    tookMs = Date.now() - started;
  });

  await then(
    'it gets the status "failing" within 3 seconds and the detail "no answer within 2 s: check FOREMAN_TEMPORAL_ADDRESS"',
    async () => {
      expect(tookMs).toBeLessThan(3000);
      expect(health).toEqual({
        status: "failing",
        checks: [{ name: "temporal", ok: false, detail: "no answer within 2 s: check FOREMAN_TEMPORAL_ADDRESS" }],
      });
    },
  );
});

import { type Health, healthOf, type Probe } from "@opensoftware/cli";
import { scenario } from "@opensoftware/testkit";

scenario("SCN-CLI-018", async ({ given, when, then }) => {
  let probes: Probe[] = [];
  await given(
    'the probe "database" that fails with "connection refused" and the fix "check INTAKE_DATABASE_URL"',
    async () => {
      probes = [
        {
          name: "database",
          check: () => Promise.reject(new Error("connection refused")),
          fix: "check INTAKE_DATABASE_URL",
        },
      ];
    },
  );

  let health: Health;
  await when("the module asks for its health", async () => {
    health = await healthOf(probes);
  });

  await then(
    'it gets the status "failing" with the check "database" not ok and the detail "connection refused: check INTAKE_DATABASE_URL"',
    async () => {
      expect(health).toEqual({
        status: "failing",
        checks: [{ name: "database", ok: false, detail: "connection refused: check INTAKE_DATABASE_URL" }],
      });
    },
  );
});

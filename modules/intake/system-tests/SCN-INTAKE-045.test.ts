import { scenario } from "@opensoftware/testkit";
import { serving } from "./server.ts";

scenario("SCN-INTAKE-045", async ({ sut, given, when, then }) => {
  await given('the server runs with "INTAKE_NATS_URL" set to a port where no NATS listens', async () => {
    await serving(sut, { INTAKE_NATS_URL: "nats://127.0.0.1:1" });
  });

  let answer: Awaited<ReturnType<typeof sut.http.request>>;
  await when('a program reads "/v1/health" without a token', async () => {
    answer = await sut.http.request("GET", "/v1/health");
  });

  await then(
    'the answer is 503 with the status "failing", the check "database" ok and the check "nats" failing with a detail that names "INTAKE_NATS_URL"',
    async () => {
      expect(answer.status).toBe(503);
      const health = answer.body as { status: string; checks: { name: string; ok: boolean; detail?: string }[] };
      expect(health.status).toBe("failing");
      expect(health.checks.map(({ name, ok }) => ({ name, ok }))).toEqual([
        { name: "database", ok: true },
        { name: "nats", ok: false },
      ]);
      expect(health.checks[1]?.detail).toContain("INTAKE_NATS_URL");
    },
  );
});

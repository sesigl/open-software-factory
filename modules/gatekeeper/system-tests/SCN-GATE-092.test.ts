import { scenario } from "@opensoftware/testkit";
import { serving } from "./server.ts";

scenario("SCN-GATE-092", async ({ sut, fakes, given, when, then }) => {
  await given(
    'the server runs the README\'s files with "GATEKEEPER_OPA" set to a program that does not exist',
    async () => {
      await serving(sut, fakes, { env: { GATEKEEPER_OPA: sut.files.path("$INPUT/no-opa") } });
    },
  );

  let answer: Awaited<ReturnType<typeof sut.http.request>>;
  await when('a program reads "/v1/health" without a token', async () => {
    answer = await sut.http.request("GET", "/v1/health");
  });

  await then(
    'the answer is 503 with the status "failing" and the check "opa" failing with a detail that names "GATEKEEPER_OPA"',
    async () => {
      expect(answer.status).toBe(503);
      const health = answer.body as { status: string; checks: { name: string; ok: boolean; detail?: string }[] };
      expect(health.status).toBe("failing");
      const opa = health.checks.find(({ name }) => name === "opa");
      expect(opa).toMatchObject({ ok: false });
      expect(opa?.detail).toContain("GATEKEEPER_OPA");
      expect(health.checks.find(({ name }) => name === "database")).toEqual({ name: "database", ok: true });
    },
  );
});

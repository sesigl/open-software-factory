import { scenario } from "@opensoftware/testkit";
import { servingGateway } from "./foreman.ts";

scenario("SCN-FORE-086", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof servingGateway>>;
  await given(
    '"foreman serve" runs the README\'s "gateway/factory.yaml" with a fake inference adapter as "litellm" whose start fails with "LiteLLM is not ready"',
    async () => {
      server = await servingGateway(sut, fakes, {
        inference: { startFails: "LiteLLM is not ready" },
        env: { FOREMAN_INFERENCE_RETRY_MS: "100" },
      });
    },
  );

  let answer: Awaited<ReturnType<typeof sut.http.request>>;
  await when('a program reads "/v1/health" without a token', async () => {
    answer = await sut.http.request("GET", "/v1/health");
  });

  await then('the answer is 503 with the check "inference" failing with "LiteLLM is not ready"', async () => {
    expect(answer.status).toBe(503);
    const body = answer.body as { status: string; checks: { name: string; ok: boolean; detail?: string }[] };
    expect(body.status).toBe("failing");
    expect(body.checks.find((check) => check.name === "inference")).toEqual({
      name: "inference",
      ok: false,
      detail: expect.stringContaining("LiteLLM is not ready"),
    });
  });

  await then(
    'after the adapter is ready, "/v1/health" answers 200 with the check "inference" ok, and the adapter started one gateway',
    async () => {
      server.inference?.ready();
      let health = await sut.http.request("GET", "/v1/health");
      // The server tries again every FOREMAN_INFERENCE_RETRY_MS; the step waits for the result, up to 10 s.
      for (let attempt = 0; health.status !== 200 && attempt < 100; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        health = await sut.http.request("GET", "/v1/health");
      }
      expect(health.status, JSON.stringify(health.body)).toBe(200);
      expect((health.body as { checks: { name: string; ok: boolean }[] }).checks).toContainEqual({
        name: "inference",
        ok: true,
      });
      expect(server.inference?.list()).toEqual(["000000000001"]);
    },
  );
});

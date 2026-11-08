import { scenario } from "@opensoftware/testkit";
import { readmeWork, serving } from "./foreman.ts";
import { receiver } from "./traces.ts";

scenario("SCN-FORE-076", async ({ sut, fakes, given, when, then }) => {
  let otlp: Awaited<ReturnType<typeof receiver>>;
  let server: Awaited<ReturnType<typeof serving>>;
  await given(
    '"foreman serve" runs the README\'s "factory.yaml" with "OTEL_EXPORTER_OTLP_ENDPOINT" set to an OTLP receiver',
    async () => {
      otlp = await receiver(fakes);
      server = await serving(sut, fakes, { env: { OTEL_EXPORTER_OTLP_ENDPOINT: otlp.url } });
    },
  );

  let runId = "";
  await when('a program posts the README\'s "work.json" to "/v1/runs" with the API token', async () => {
    runId = (await server.start(readmeWork(fakes))).data?.runId as string;
  });

  await when("the run completes", async () => {
    await server.until(runId, "complete");
    await expect.poll(() => otlp.spans().length, { timeout: 10_000 }).toBe(3);
  });

  await then(
    'the receiver got the spans "stage plan", "stage implement" and "run hello", each with the run\'s "osf.run.id" and the same trace ID',
    async () => {
      const spans = otlp.spans();
      expect(spans.map(({ name }) => name)).toEqual(["stage plan", "stage implement", "run hello"]);
      expect(new Set(spans.map(({ traceId }) => traceId)).size).toBe(1);
      expect(spans[0]?.traceId).toMatch(/^[0-9a-f]{32}$/);
      for (const span of spans) expect(span.resource["osf.run.id"]).toBe(runId);
    },
  );

  await then(
    'the stage spans are children of the run\'s span, with the outcome "succeeded" and the agent of their stage',
    async () => {
      const [plan, implement, run] = otlp.spans();
      expect(run?.parentSpanId).toBeUndefined();
      expect([plan?.parentSpanId, implement?.parentSpanId]).toEqual([run?.spanId, run?.spanId]);
      expect(plan?.attributes).toMatchObject({ "osf.outcome": "succeeded", "osf.agent": "plan", "osf.stage": "plan" });
      expect(implement?.attributes).toMatchObject({
        "osf.outcome": "succeeded",
        "osf.agent": "implement",
        "osf.stage": "implement",
      });
      expect(run?.attributes).toMatchObject({ "osf.outcome": "succeeded" });
    },
  );
});

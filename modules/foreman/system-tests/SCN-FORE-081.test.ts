import { scenario } from "@opensoftware/testkit";
import { readmeWork, serving } from "./foreman.ts";
import { receiver } from "./traces.ts";

scenario("SCN-FORE-081", async ({ sut, fakes, given, when, then }) => {
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

  await then('"/v1/runs/<id>" shows the "traceId" of the spans the receiver got', async () => {
    const view = await server.view(runId);
    expect(view.traceId).toMatch(/^[0-9a-f]{32}$/);
    expect(otlp.spans().map(({ traceId }) => traceId)).toEqual([view.traceId, view.traceId, view.traceId]);
  });
});

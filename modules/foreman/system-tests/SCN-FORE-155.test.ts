import { scenario } from "@opensoftware/testkit";
import { endingTurns, readmeWork, serving } from "./foreman.ts";
import { receiver } from "./traces.ts";

const turns = endingTurns.map((turn) => ({ ...turn, usage: { inputTokens: 900, outputTokens: 30 }, costUsd: 0.25 }));

scenario("SCN-FORE-155", async ({ sut, fakes, given, when, then }) => {
  let otlp: Awaited<ReturnType<typeof receiver>>;
  let server: Awaited<ReturnType<typeof serving>>;
  await given(
    '"foreman serve" runs the README\'s "factory.yaml" with "OTEL_EXPORTER_OTLP_ENDPOINT" set to an OTLP receiver, and a harness whose turns report 900 input tokens, 30 output tokens and 0.25 USD',
    async () => {
      otlp = await receiver(fakes);
      server = await serving(sut, fakes, { env: { OTEL_EXPORTER_OTLP_ENDPOINT: otlp.url }, turns });
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
    'the spans "stage plan" and "stage implement" carry "gen_ai.usage.input_tokens" 900, "gen_ai.usage.output_tokens" 30 and "osf.cost.usd" 0.25 from the run record of their session',
    async () => {
      const stages = otlp.spans().filter(({ name }) => name.startsWith("stage "));
      expect(stages.map(({ name }) => name)).toEqual(["stage plan", "stage implement"]);
      for (const { attributes } of stages)
        expect(attributes).toMatchObject({
          "gen_ai.usage.input_tokens": 900,
          "gen_ai.usage.output_tokens": 30,
          "osf.cost.usd": 0.25,
        });
    },
  );

  await then('"/v1/runs/<id>" names the "spanId" of each stage\'s span', async () => {
    const spans = otlp.spans().filter(({ name }) => name.startsWith("stage "));
    expect((await server.view(runId)).stages.map(({ spanId }) => spanId)).toEqual(spans.map(({ spanId }) => spanId));
  });
});

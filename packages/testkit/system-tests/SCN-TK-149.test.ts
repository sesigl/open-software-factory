import { scenario, type TraceStore } from "@opensoftware/testkit";

const TRACE = "4bf92f3577b34da6a3ce929d0e0e4736";

scenario("SCN-TK-149", async ({ fakes, given, when, then }) => {
  let stores: TraceStore[] = [];
  await given('fakes.traceStore, and fakes.traceStore with "keep: false"', async () => {
    stores = [await fakes.traceStore(), await fakes.traceStore({ keep: false })];
  });

  const answers: string[] = [];
  await when(
    'a module sends the span "ping" of the service "demo" by OTLP/HTTP to each store and asks Jaeger\'s query API of that store for its trace',
    async () => {
      const span = { traceId: TRACE, spanId: "00f067aa0ba902b7", name: "ping" };
      const resource = { attributes: [{ key: "service.name", value: { stringValue: "demo" } }] };
      for (const store of stores) {
        const sent = await fetch(`${store.otlpUrl}/v1/traces`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ resourceSpans: [{ resource, scopeSpans: [{ spans: [span] }] }] }),
        });
        const answer = await fetch(`${store.queryUrl}/api/traces/${TRACE}`);
        answers.push(`${sent.status} ${answer.status} ${await answer.text()}`);
      }
    },
  );

  await then(
    'the first store answers with the span "ping" and the second with the status 404, and both received the span',
    async () => {
      const spans = [{ traceID: TRACE, spanID: "00f067aa0ba902b7", operationName: "ping", processID: "p1" }];
      const trace = { traceID: TRACE, spans, processes: { p1: { serviceName: "demo", tags: [] } } };
      expect(answers[0]).toBe(`200 200 ${JSON.stringify({ data: [trace] })}`);
      expect(answers[1]).toBe('200 404 {"data":null,"errors":[{"code":404,"msg":"trace not found"}]}');
      const span = { traceId: TRACE, spanId: "00f067aa0ba902b7", name: "ping", service: "demo" };
      expect(stores.map((store) => store.spans())).toEqual([[span], [span]]);
    },
  );
});

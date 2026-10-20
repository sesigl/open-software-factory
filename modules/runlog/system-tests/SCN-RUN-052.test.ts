import { type Collector, scenario } from "@opensoftware/testkit";
import { collectorFor, exportedSpan, nativeSpan } from "./collector.ts";
import type { Span } from "./otlp.ts";

scenario("SCN-RUN-052", async ({ sut, fakes, given, when, then }) => {
  let collector: Collector;
  await given('a Collector with the config that "runlog collector opencode" wrote', async () => {
    collector = await collectorFor(sut, fakes, "opencode");
  });

  let span: Span;
  await when(
    'OpenCode sends the span "ai.streamText" of the provider "anthropic.messages" to the Collector',
    async () => {
      span = await exportedSpan(collector, nativeSpan("ai.streamText", { "ai.model.provider": "anthropic.messages" }));
    },
  );

  await then(
    'the Collector exports the span "invoke_agent" with "gen_ai.operation.name" "invoke_agent" and "gen_ai.provider.name" "anthropic.messages"',
    async () => {
      expect(span.name).toBe("invoke_agent");
      expect(span.attributes["gen_ai.operation.name"]).toBe("invoke_agent");
      expect(span.attributes["gen_ai.provider.name"]).toBe("anthropic.messages");
    },
  );
});

import { type Collector, scenario } from "@opensoftware/testkit";
import { collectorFor, exportedSpan, nativeSpan } from "./collector.ts";
import type { Span } from "./otlp.ts";

scenario("SCN-RUN-045", async ({ sut, fakes, given, when, then }) => {
  let collector: Collector;
  await given('a Collector with the config that "runlog collector claude-code" wrote', async () => {
    collector = await collectorFor(sut, fakes, "claude-code");
  });

  let span: Span;
  await when(
    'Claude Code sends the span "claude_code.llm_request" of "claude-sonnet-5-5" with 1200 input, 300 output and 800 cache read tokens to the Collector',
    async () => {
      span = await exportedSpan(
        collector,
        nativeSpan("claude_code.llm_request", {
          model: "claude-sonnet-5-5",
          input_tokens: 1200,
          output_tokens: 300,
          cache_read_tokens: 800,
        }),
      );
    },
  );

  await then(
    'the Collector exports the span "chat claude-sonnet-5-5" with "gen_ai.operation.name" "chat" and "gen_ai.request.model" "claude-sonnet-5-5"',
    async () => {
      expect(span.name).toBe("chat claude-sonnet-5-5");
      expect(span.attributes["gen_ai.operation.name"]).toBe("chat");
      expect(span.attributes["gen_ai.request.model"]).toBe("claude-sonnet-5-5");
    },
  );

  await then(
    'the exported span has "gen_ai.usage.input_tokens" 1200, "gen_ai.usage.output_tokens" 300 and "gen_ai.usage.cache_read.input_tokens" 800',
    async () => {
      expect(span.attributes["gen_ai.usage.input_tokens"]).toBe(1200);
      expect(span.attributes["gen_ai.usage.output_tokens"]).toBe(300);
      expect(span.attributes["gen_ai.usage.cache_read.input_tokens"]).toBe(800);
    },
  );
});

import { type Collector, scenario } from "@opensoftware/testkit";
import { collectorFor, exportedSpan, nativeSpan } from "./collector.ts";
import type { Span } from "./otlp.ts";

scenario("SCN-RUN-051", async ({ sut, fakes, given, when, then }) => {
  let collector: Collector;
  await given('a Collector with the config that "runlog collector opencode" wrote', async () => {
    collector = await collectorFor(sut, fakes, "opencode");
  });

  let span: Span;
  await when(
    'OpenCode sends the span "ai.streamText.doStream" of "claude-sonnet-5-5" with 2800 input and 80 output tokens to the Collector',
    async () => {
      span = await exportedSpan(
        collector,
        nativeSpan("ai.streamText.doStream", {
          "gen_ai.request.model": "claude-sonnet-5-5",
          "gen_ai.usage.input_tokens": 2800,
          "gen_ai.usage.output_tokens": 80,
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

  await then('the exported span has "gen_ai.usage.input_tokens" 2800 and "gen_ai.usage.output_tokens" 80', async () => {
    expect(span.attributes["gen_ai.usage.input_tokens"]).toBe(2800);
    expect(span.attributes["gen_ai.usage.output_tokens"]).toBe(80);
  });

  await then('the exported resource has "osf.harness.name" "opencode"', async () => {
    expect(span.resource["osf.harness.name"]).toBe("opencode");
  });
});

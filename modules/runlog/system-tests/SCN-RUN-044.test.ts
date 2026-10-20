import { type Collector, scenario } from "@opensoftware/testkit";
import { collectorFor, exportedSpan, nativeSpan } from "./collector.ts";
import type { Span } from "./otlp.ts";

scenario("SCN-RUN-044", async ({ sut, fakes, given, when, then }) => {
  let collector: Collector;
  await given('a Collector with the config that "runlog collector claude-code" wrote', async () => {
    collector = await collectorFor(sut, fakes, "claude-code");
  });

  let span: Span;
  await when(
    'Claude Code sends the span "claude_code.interaction" of the session "5b8e0c7e-1d2a-4f00-9a7e-0d1f2a3b4c5d" to the Collector',
    async () => {
      span = await exportedSpan(
        collector,
        nativeSpan(
          "claude_code.interaction",
          { "session.id": "5b8e0c7e-1d2a-4f00-9a7e-0d1f2a3b4c5d", "span.type": "interaction" },
          { "service.name": "claude-code" },
        ),
      );
    },
  );

  await then(
    'the Collector exports the span "invoke_agent" with "gen_ai.operation.name" "invoke_agent" and "gen_ai.conversation.id" "5b8e0c7e-1d2a-4f00-9a7e-0d1f2a3b4c5d"',
    async () => {
      expect(span.name).toBe("invoke_agent");
      expect(span.attributes["gen_ai.operation.name"]).toBe("invoke_agent");
      expect(span.attributes["gen_ai.conversation.id"]).toBe("5b8e0c7e-1d2a-4f00-9a7e-0d1f2a3b4c5d");
    },
  );

  await then('the exported resource has "osf.harness.name" "claude-code"', async () => {
    expect(span.resource["osf.harness.name"]).toBe("claude-code");
  });
});

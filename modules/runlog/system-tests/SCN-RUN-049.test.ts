import { type Collector, scenario } from "@opensoftware/testkit";
import { collectorFor, exportedSpan, nativeSpan } from "./collector.ts";
import type { Span } from "./otlp.ts";

scenario("SCN-RUN-049", async ({ sut, fakes, given, when, then }) => {
  let collector: Collector;
  await given('a Collector with the config that "runlog collector codex" wrote', async () => {
    collector = await collectorFor(sut, fakes, "codex");
  });

  let span: Span;
  await when(
    'Codex sends the span "session_loop" with "conversation.id" "019a2b3c-4d5e-7f60-8a9b-0c1d2e3f4a5b" to the Collector',
    async () => {
      span = await exportedSpan(
        collector,
        nativeSpan("session_loop", { "conversation.id": "019a2b3c-4d5e-7f60-8a9b-0c1d2e3f4a5b" }),
      );
    },
  );

  await then(
    'the Collector exports the span "invoke_agent" with "gen_ai.operation.name" "invoke_agent" and "gen_ai.conversation.id" "019a2b3c-4d5e-7f60-8a9b-0c1d2e3f4a5b"',
    async () => {
      expect(span.name).toBe("invoke_agent");
      expect(span.attributes["gen_ai.operation.name"]).toBe("invoke_agent");
      expect(span.attributes["gen_ai.conversation.id"]).toBe("019a2b3c-4d5e-7f60-8a9b-0c1d2e3f4a5b");
    },
  );

  await then('the exported resource has "osf.harness.name" "codex"', async () => {
    expect(span.resource["osf.harness.name"]).toBe("codex");
  });
});

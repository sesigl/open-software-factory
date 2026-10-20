import { type Collector, scenario } from "@opensoftware/testkit";
import { collectorFor, exportedSpan, nativeSpan } from "./collector.ts";
import type { Span } from "./otlp.ts";

scenario("SCN-RUN-050", async ({ sut, fakes, given, when, then }) => {
  let collector: Collector;
  await given('a Collector with the config that "runlog collector codex" wrote', async () => {
    collector = await collectorFor(sut, fakes, "codex");
  });

  let span: Span;
  await when('Codex sends the span "handle_responses" to the Collector', async () => {
    span = await exportedSpan(collector, nativeSpan("handle_responses"));
  });

  await then('the Collector exports the span "chat" with "gen_ai.operation.name" "chat"', async () => {
    expect(span.name).toBe("chat");
    expect(span.attributes["gen_ai.operation.name"]).toBe("chat");
  });
});

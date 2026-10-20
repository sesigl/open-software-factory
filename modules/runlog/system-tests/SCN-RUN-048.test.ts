import { type Collector, scenario } from "@opensoftware/testkit";
import { collectorFor, exportedSpan, nativeSpan } from "./collector.ts";
import type { Span } from "./otlp.ts";

scenario("SCN-RUN-048", async ({ sut, fakes, given, when, then }) => {
  let collector: Collector;
  await given('a Collector with the config that "runlog collector claude-code" wrote', async () => {
    collector = await collectorFor(sut, fakes, "claude-code");
  });

  let span: Span;
  await when(
    'Claude Code sends the span "claude_code.interaction" with the resource "osf.run.id" "run-7" and "osf.harness.name" "claude-code-sdk" to the Collector',
    async () => {
      span = await exportedSpan(
        collector,
        nativeSpan("claude_code.interaction", {}, { "osf.run.id": "run-7", "osf.harness.name": "claude-code-sdk" }),
      );
    },
  );

  await then('the exported resource has "osf.run.id" "run-7" and "osf.harness.name" "claude-code-sdk"', async () => {
    expect(span.resource["osf.run.id"]).toBe("run-7");
    expect(span.resource["osf.harness.name"]).toBe("claude-code-sdk");
  });
});

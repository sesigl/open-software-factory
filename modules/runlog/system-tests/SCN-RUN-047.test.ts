import { type Collector, scenario } from "@opensoftware/testkit";
import { collectorFor, exportedSpan, nativeSpan } from "./collector.ts";
import type { Span } from "./otlp.ts";

scenario("SCN-RUN-047", async ({ sut, fakes, given, when, then }) => {
  let collector: Collector;
  await given('a Collector with the config that "runlog collector claude-code" wrote', async () => {
    collector = await collectorFor(sut, fakes, "claude-code");
  });

  let span: Span;
  await when(
    'Claude Code sends the span "claude_code.interaction" with the "user_prompt" "fix the login bug" to the Collector',
    async () => {
      span = await exportedSpan(collector, nativeSpan("claude_code.interaction", { user_prompt: "fix the login bug" }));
    },
  );

  await then('the Collector exports the span "invoke_agent" without the attribute "user_prompt"', async () => {
    expect(span.name).toBe("invoke_agent");
    expect(Object.keys(span.attributes)).not.toContain("user_prompt");
  });
});

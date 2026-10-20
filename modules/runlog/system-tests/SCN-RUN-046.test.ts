import { type Collector, scenario } from "@opensoftware/testkit";
import { collectorFor, exportedSpan, nativeSpan } from "./collector.ts";
import type { Span } from "./otlp.ts";

scenario("SCN-RUN-046", async ({ sut, fakes, given, when, then }) => {
  let collector: Collector;
  await given('a Collector with the config that "runlog collector claude-code" wrote', async () => {
    collector = await collectorFor(sut, fakes, "claude-code");
  });

  let span: Span;
  await when(
    'Claude Code sends the span "claude_code.tool" of the tool "Bash" with the call "toolu_01" to the Collector',
    async () => {
      span = await exportedSpan(
        collector,
        nativeSpan("claude_code.tool", { tool_name: "Bash", "gen_ai.tool.call.id": "toolu_01" }),
      );
    },
  );

  await then(
    'the Collector exports the span "execute_tool Bash" with "gen_ai.tool.name" "Bash" and "gen_ai.tool.call.id" "toolu_01"',
    async () => {
      expect(span.name).toBe("execute_tool Bash");
      expect(span.attributes["gen_ai.tool.name"]).toBe("Bash");
      expect(span.attributes["gen_ai.tool.call.id"]).toBe("toolu_01");
    },
  );
});

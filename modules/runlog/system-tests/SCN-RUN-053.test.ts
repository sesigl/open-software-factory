import { type Collector, scenario } from "@opensoftware/testkit";
import { collectorFor, exportedSpan, nativeSpan } from "./collector.ts";
import type { Span } from "./otlp.ts";

scenario("SCN-RUN-053", async ({ sut, fakes, given, when, then }) => {
  let collector: Collector;
  await given('a Collector with the config that "runlog collector opencode" wrote', async () => {
    collector = await collectorFor(sut, fakes, "opencode");
  });

  let span: Span;
  await when(
    'OpenCode sends the span "ai.toolCall" of the tool "bash" with the call "call_01" and the arguments "{\\"command\\":\\"ls\\"}" to the Collector',
    async () => {
      span = await exportedSpan(
        collector,
        nativeSpan("ai.toolCall", {
          "ai.toolCall.name": "bash",
          "ai.toolCall.id": "call_01",
          "ai.toolCall.args": '{"command":"ls"}',
        }),
      );
    },
  );

  await then(
    'the Collector exports the span "execute_tool bash" with "gen_ai.tool.name" "bash" and "gen_ai.tool.call.id" "call_01"',
    async () => {
      expect(span.name).toBe("execute_tool bash");
      expect(span.attributes["gen_ai.tool.name"]).toBe("bash");
      expect(span.attributes["gen_ai.tool.call.id"]).toBe("call_01");
    },
  );

  await then('the exported span has no attribute "ai.toolCall.args"', async () => {
    expect(Object.keys(span.attributes)).not.toContain("ai.toolCall.args");
  });
});

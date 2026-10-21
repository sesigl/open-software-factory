// Runs from OTLP/JSON trace export requests, one per line, as runlog writes them. A run is the root span
// invoke_agent with the other spans of its trace.

import { type Input, UsageError } from "@opensoftware/cli";
import { type AttributeValue, runSpans, type SpanAttributes } from "@opensoftware/contracts";
import { jsonLines } from "./lines.ts";

export type Value = AttributeValue;

export interface Span {
  spanId: string;
  name: string;
  start: bigint;
  end: bigint;
  attributes: SpanAttributes;
}

export interface Run {
  id: string;
  traceId: string;
  resource: SpanAttributes;
  root: Span;
  /** Every other span of the trace, by start time. */
  spans: Span[];
}

/** The runs of the given files, in the order their traces first appear. */
export function parseRuns(files: Input[]): Run[] {
  const traces = new Map<string, { resource: SpanAttributes; spans: Map<string, Span> }>();
  for (const { file, text } of files) {
    for (const { line, value: request } of jsonLines(file, text)) {
      const spans = runSpans(request);
      if (!spans) throw new UsageError(`${file}:${line}: not an OTLP/JSON trace export request`);
      for (const { traceId, resource, spanId, name, start, end, attributes } of spans) {
        const trace = traces.get(traceId) ?? { resource, spans: new Map() };
        traces.set(traceId, trace);
        trace.spans.set(spanId, { spanId, name, start, end, attributes });
        if (name === "invoke_agent") trace.resource = resource;
      }
    }
  }
  const runs: Run[] = [];
  for (const [traceId, { resource, spans }] of traces) {
    const ordered = [...spans.values()].sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));
    const root = ordered.find((span) => span.attributes["gen_ai.operation.name"] === "invoke_agent");
    if (!root) continue;
    const id = resource["osf.run.id"] ?? root.attributes["gen_ai.conversation.id"] ?? traceId;
    runs.push({ id: String(id), traceId, resource, root, spans: ordered.filter((span) => span !== root) });
  }
  return runs;
}

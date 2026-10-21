// Runs from OTLP/JSON trace export requests, one per line, as runlog writes them. A run is the root span
// invoke_agent with the other spans of its trace.
import { UsageError } from "./errors.ts";
import { jsonLines } from "./lines.ts";

export type Value = string | number | Value[] | undefined;

export interface Span {
  spanId: string;
  name: string;
  start: bigint;
  end: bigint;
  attributes: Record<string, Value>;
}

export interface Run {
  id: string;
  traceId: string;
  resource: Record<string, Value>;
  root: Span;
  /** Every other span of the trace, by start time. */
  spans: Span[];
}

interface OtlpValue {
  stringValue?: string;
  intValue?: string | number;
  doubleValue?: number;
  arrayValue?: { values?: OtlpValue[] };
}
type OtlpAttributes = { key: string; value: OtlpValue }[] | undefined;

/** An OTLP/JSON attribute value; runlog writes strings, integers, doubles and arrays. */
const value = (otlp: OtlpValue): Value => {
  if (otlp.arrayValue) return (otlp.arrayValue.values ?? []).map(value);
  return otlp.intValue === undefined ? (otlp.stringValue ?? otlp.doubleValue) : Number(otlp.intValue);
};

const attributes = (list: OtlpAttributes): Record<string, Value> =>
  Object.fromEntries((list ?? []).map(({ key, value: entry }) => [key, value(entry)]));

/** The runs of the given files, in the order their traces first appear. Each file is [name, text]. */
export function parseRuns(files: [string, string][]): Run[] {
  const traces = new Map<string, { resource: Record<string, Value>; spans: Map<string, Span> }>();
  for (const [file, text] of files) {
    for (const { line, value: request } of jsonLines(file, text)) {
      const { resourceSpans: all } = (request ?? {}) as { resourceSpans?: unknown };
      if (!Array.isArray(all)) throw new UsageError(`${file}:${line}: not an OTLP/JSON trace export request`);
      for (const resourceSpans of all) {
        const resource = attributes(resourceSpans.resource?.attributes);
        for (const scope of resourceSpans.scopeSpans ?? [])
          for (const otlp of scope.spans ?? []) {
            const trace = traces.get(otlp.traceId) ?? { resource, spans: new Map() };
            traces.set(otlp.traceId, trace);
            trace.spans.set(otlp.spanId, {
              spanId: otlp.spanId,
              name: otlp.name ?? "",
              start: BigInt(otlp.startTimeUnixNano ?? 0),
              end: BigInt(otlp.endTimeUnixNano ?? 0),
              attributes: attributes(otlp.attributes),
            });
            if (otlp.name === "invoke_agent") trace.resource = resource;
          }
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

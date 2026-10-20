// Reads the OTLP/JSON that runlog writes or sends: one ExportTraceServiceRequest per run.

type AnyValue = {
  stringValue?: string;
  intValue?: number | string;
  doubleValue?: number;
  boolValue?: boolean;
  arrayValue?: { values?: AnyValue[] };
};
type KeyValue = { key: string; value: AnyValue };
interface OtlpSpan {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  startTimeUnixNano: string;
  endTimeUnixNano: string;
  attributes?: KeyValue[];
}
interface OtlpRequest {
  resourceSpans: { resource: { attributes: KeyValue[] }; scopeSpans: { spans: OtlpSpan[] }[] }[];
}

export interface Span {
  traceId: string;
  spanId: string;
  parentSpanId: string | undefined;
  name: string;
  /** Seconds between start and end. */
  seconds: number;
  attributes: Record<string, unknown>;
  /** The attributes of the resource the span belongs to. */
  resource: Record<string, unknown>;
}

export interface Run {
  resource: Record<string, unknown>;
  spans: Span[];
  root: Span;
}

function value(any: AnyValue): unknown {
  if (any.arrayValue) return (any.arrayValue.values ?? []).map(value);
  if (any.intValue !== undefined) return Number(any.intValue);
  return any.stringValue ?? any.doubleValue ?? any.boolValue;
}

const record = (attributes: KeyValue[] = []): Record<string, unknown> =>
  Object.fromEntries(attributes.map(({ key, value: any }) => [key, value(any)]));

/** One run from an OTLP/JSON export request, parsed or as text. */
export function runOf(request: unknown): Run {
  const parsed = (typeof request === "string" ? JSON.parse(request) : request) as OtlpRequest;
  const spans = parsed.resourceSpans.flatMap((group) => {
    const resource = record(group.resource.attributes);
    return group.scopeSpans.flatMap((scope) =>
      scope.spans.map((span) => ({
        traceId: span.traceId,
        spanId: span.spanId,
        parentSpanId: span.parentSpanId || undefined,
        name: span.name,
        seconds: Number((BigInt(span.endTimeUnixNano) - BigInt(span.startTimeUnixNano)) / 1_000_000_000n),
        attributes: record(span.attributes),
        resource,
      })),
    );
  });
  // An attached run's root span has the launcher's span as parent.
  const root = spans.find((span) => span.name === "invoke_agent") ?? spans.find((span) => !span.parentSpanId);
  if (!root) throw new Error("the run has no root span");
  return { resource: root.resource, spans, root };
}

/** The runs of a runs.jsonl file, one per line. */
export function runsOf(jsonl: string): Run[] {
  return jsonl
    .split("\n")
    .filter((line) => line.trim())
    .map(runOf);
}

/** The spans below the root span with this name, in order. */
export function children(run: Run, name: string): Span[] {
  return run.spans.filter((span) => span.parentSpanId === run.root.spanId && span.name === name);
}

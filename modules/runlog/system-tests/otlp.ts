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
  kind: number;
  startTimeUnixNano: string;
  endTimeUnixNano: string;
  attributes?: KeyValue[];
}
interface OtlpRequest {
  resourceSpans: {
    resource: { attributes: KeyValue[] };
    scopeSpans: { scope?: { name?: string; version?: string }; spans: OtlpSpan[] }[];
  }[];
}

export interface Span {
  traceId: string;
  spanId: string;
  parentSpanId: string | undefined;
  name: string;
  /** "internal", "client" or another OTLP span kind. */
  kind: string;
  /** The start and the end as ISO 8601 times with milliseconds. */
  start: string;
  end: string;
  /** Seconds between start and end. */
  seconds: number;
  /** The instrumentation scope as "<name> <version>". */
  scope: string;
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

// OTLP span kinds: SPAN_KIND_INTERNAL is 1, SPAN_KIND_SERVER 2, SPAN_KIND_CLIENT 3.
const KINDS = ["unspecified", "internal", "server", "client", "producer", "consumer"];

const iso = (nanos: string): string => new Date(Number(BigInt(nanos) / 1_000_000n)).toISOString();

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
        kind: KINDS[span.kind] ?? String(span.kind),
        start: iso(span.startTimeUnixNano),
        end: iso(span.endTimeUnixNano),
        scope: `${scope.scope?.name} ${scope.scope?.version}`,
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

/** The GenAI message JSON of a span attribute such as "gen_ai.input.messages", as [role, text] pairs. */
export function messagesIn(span: Span | undefined, key: string): [string, string][] {
  const list = JSON.parse(String(span?.attributes[key])) as { role: string; parts: { content: string }[] }[];
  return list.map((message) => [message.role, message.parts.map((part) => part.content).join("")]);
}

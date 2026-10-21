// Reading run records: OTLP/JSON trace export requests with the run-record attributes, as runlog writes them.

/** An OTLP/JSON attribute value as runlog writes it: a string, an integer, a double or an array of them. */
export type AttributeValue = string | number | AttributeValue[] | undefined;
export type SpanAttributes = Record<string, AttributeValue>;

/** One span of a run record, with its resource. */
export interface RunSpan {
  traceId: string;
  spanId: string;
  parentSpanId: string | undefined;
  name: string;
  /** Unix time in nanoseconds; 0 when the span has none. */
  start: bigint;
  end: bigint;
  /** The attributes of the span's resource, like `osf.run.id`. */
  resource: SpanAttributes;
  attributes: SpanAttributes;
}

interface OtlpValue {
  stringValue?: string;
  intValue?: string | number;
  doubleValue?: number;
  arrayValue?: { values?: OtlpValue[] };
}
type OtlpAttributes = { key: string; value: OtlpValue }[] | undefined;
interface OtlpSpan {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name?: string;
  startTimeUnixNano?: string | number;
  endTimeUnixNano?: string | number;
  attributes?: OtlpAttributes;
}
interface OtlpResourceSpans {
  resource?: { attributes?: OtlpAttributes };
  scopeSpans?: { spans?: OtlpSpan[] }[];
}

/** The spans of a run record in the order they appear; undefined when the value is no OTLP/JSON trace export request. */
export function runSpans(record: unknown): RunSpan[] | undefined {
  const { resourceSpans } = (record ?? {}) as { resourceSpans?: unknown };
  if (!Array.isArray(resourceSpans)) return undefined;
  return (resourceSpans as OtlpResourceSpans[]).flatMap((entry) => {
    const resource = decode(entry.resource?.attributes);
    return (entry.scopeSpans ?? []).flatMap((scope) =>
      (scope.spans ?? []).map((span) => ({
        traceId: span.traceId,
        spanId: span.spanId,
        parentSpanId: span.parentSpanId || undefined,
        name: span.name ?? "",
        start: BigInt(span.startTimeUnixNano ?? 0),
        end: BigInt(span.endTimeUnixNano ?? 0),
        resource,
        attributes: decode(span.attributes),
      })),
    );
  });
}

const value = (otlp: OtlpValue): AttributeValue => {
  if (otlp.arrayValue) return (otlp.arrayValue.values ?? []).map(value);
  return otlp.intValue === undefined ? (otlp.stringValue ?? otlp.doubleValue) : Number(otlp.intValue);
};

const decode = (list: OtlpAttributes): SpanAttributes =>
  Object.fromEntries((list ?? []).map(({ key, value: entry }) => [key, value(entry)]));

// The trace of a run (ADR 0087): one OTLP trace per run, with a span for the run and a span per stage. The IDs come
// from the run's ID, so a restarted foreman and every harness of the run name the same trace.
import { createHash } from "node:crypto";

const hex = (text: string) => createHash("sha256").update(text).digest("hex");

/** The run's trace ID: 32 hex digits. */
export const traceIdOf = (runId: string): string => hex(runId).slice(0, 32);

/** The span ID of the run's own span: 16 hex digits. */
export const runSpanIdOf = (runId: string): string => hex(runId).slice(32, 48);

/** The span ID of the stage at `index`, which is the parent of the harness's spans. */
export const stageSpanIdOf = (runId: string, index: number): string => hex(`${runId}:${index}`).slice(0, 16);

/** The W3C trace context that the stage's harness gets as TRACEPARENT. */
export const traceparentOf = (runId: string, index: number): string =>
  `00-${traceIdOf(runId)}-${stageSpanIdOf(runId, index)}-01`;

export type Outcome = "succeeded" | "failed" | "cancelled";

export interface SpanFacts {
  runId: string;
  /** The stage's index; none for the run's own span. */
  index?: number;
  name: string;
  /** ISO 8601 times. */
  start: string;
  end: string;
  outcome: Outcome;
  /** The run's resource: osf.run.id, osf.work_item.id, osf.factory.version and, for a stage, osf.stage. */
  resource: Record<string, string>;
  attributes: Record<string, string | number | undefined>;
}

const nanos = (iso: string) => `${BigInt(Date.parse(iso)) * 1_000_000n}`;

const attributesOf = (values: Record<string, string | number | undefined>) =>
  Object.entries(values).flatMap(([key, value]) =>
    value === undefined
      ? []
      : [{ key, value: typeof value === "number" ? { doubleValue: value } : { stringValue: value } }],
  );

/** One OTLP/JSON ExportTraceServiceRequest with the span. */
export function otlpOf(span: SpanFacts): unknown {
  const stage = span.index !== undefined;
  return {
    resourceSpans: [
      {
        resource: { attributes: attributesOf({ "service.name": "foreman", ...span.resource }) },
        scopeSpans: [
          {
            scope: { name: "@opensoftware/foreman" },
            spans: [
              {
                traceId: traceIdOf(span.runId),
                spanId: stage ? stageSpanIdOf(span.runId, span.index as number) : runSpanIdOf(span.runId),
                ...(stage ? { parentSpanId: runSpanIdOf(span.runId) } : {}),
                name: span.name,
                kind: 1,
                startTimeUnixNano: nanos(span.start),
                endTimeUnixNano: nanos(span.end),
                attributes: attributesOf({ ...span.attributes, "osf.outcome": span.outcome }),
                // OTLP status codes: 1 ok, 2 error.
                status: { code: span.outcome === "failed" ? 2 : 1 },
              },
            ],
          },
        ],
      },
    ],
  };
}

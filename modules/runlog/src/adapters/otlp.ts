// The run as OpenTelemetry spans: written as one OTLP/JSON line to a file, or sent to an OTLP/HTTP endpoint with the
// exporter of the OpenTelemetry JavaScript SDK, which retries on 429, 502, 503 and 504.
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { SpanKind, SpanStatusCode, TraceFlags } from "@opentelemetry/api";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { JsonTraceSerializer } from "@opentelemetry/otlp-transformer";
import { detectResources, envDetector, type Resource, resourceFromAttributes } from "@opentelemetry/resources";
import type { ReadableSpan } from "@opentelemetry/sdk-trace-base";
import type { Attributes, Run } from "../domain/run.ts";

/** The resource of the run: the attributes runlog knows, overridden by OTEL_RESOURCE_ATTRIBUTES and OTEL_SERVICE_NAME. */
export const resourceOf = (known: Attributes): Resource =>
  resourceFromAttributes(known).merge(detectResources({ detectors: [envDetector] }));

/** Milliseconds as an OpenTelemetry HrTime: [seconds, nanoseconds]. */
const hrTime = (millis: number): [number, number] => [Math.floor(millis / 1000), (millis % 1000) * 1_000_000];

export function spansOf(run: Run, resource: Resource, version: string): ReadableSpan[] {
  const context = (spanId: string) => ({ traceId: run.traceId, spanId, traceFlags: TraceFlags.SAMPLED });
  return run.spans.map((span) => {
    const start = Date.parse(span.start);
    const end = Date.parse(span.end);
    return {
      name: span.name,
      kind: span.kind === "client" ? SpanKind.CLIENT : SpanKind.INTERNAL,
      spanContext: () => context(span.spanId),
      parentSpanContext: span.parentSpanId ? context(span.parentSpanId) : undefined,
      startTime: hrTime(start),
      endTime: hrTime(end),
      duration: hrTime(end - start),
      // Stryker disable next-line ObjectLiteral: OTLP leaves out a status code of 0 (UNSET), so {} is the same span.
      status: { code: SpanStatusCode.UNSET },
      attributes: span.attributes,
      links: [],
      events: [],
      // Stryker disable next-line BooleanLiteral: the OTLP serializer reads no field "ended".
      ended: true,
      resource,
      instrumentationScope: { name: "@opensoftware/runlog", version },
      droppedAttributesCount: 0,
      droppedEventsCount: 0,
      droppedLinksCount: 0,
    };
  });
}

const line = (spans: ReadableSpan[]): string =>
  `${new TextDecoder().decode(JsonTraceSerializer.serializeRequest(spans))}\n`;

/** Appends the spans to `file` as one OTLP/JSON ExportTraceServiceRequest. */
export function appendTo(file: string, spans: ReadableSpan[]): void {
  mkdirSync(dirname(file), { recursive: true });
  appendFileSync(file, line(spans));
}

/** Writes the spans to `file` as its only line, replacing what it held. */
export function writeTo(file: string, spans: ReadableSpan[]): void {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, line(spans));
}

/** Sends the spans to the endpoint in OTEL_EXPORTER_OTLP_(TRACES_)ENDPOINT; resolves with the error, if any. */
export async function send(spans: ReadableSpan[]): Promise<Error | undefined> {
  const exporter = new OTLPTraceExporter();
  const result = await new Promise<{ error?: Error }>((resolve) => exporter.export(spans, resolve));
  await exporter.shutdown();
  return result.error;
}

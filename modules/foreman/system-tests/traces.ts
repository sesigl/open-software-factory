// Shared setup of the trace scenarios: an OTLP/HTTP receiver, and the spans it received.
import type { Fakes } from "@opensoftware/testkit";

interface Attribute {
  key: string;
  value: { stringValue?: string; doubleValue?: number };
}

export interface ReceivedSpan {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  startTimeUnixNano: string;
  endTimeUnixNano: string;
  /** OTLP status codes: 1 ok, 2 error. */
  status: { code: number };
  attributes: Record<string, string | number | undefined>;
  resource: Record<string, string | number | undefined>;
}

const valuesOf = (attributes: Attribute[]) =>
  Object.fromEntries(attributes.map(({ key, value }) => [key, value.stringValue ?? value.doubleValue]));

/** An OTLP/HTTP receiver that takes every POST /v1/traces. */
export async function receiver(fakes: Fakes) {
  const http = await fakes.http([{ method: "POST", path: "/v1/traces", body: {} }]);
  return {
    url: http.url,
    /** Every span of every request it received, in order. */
    spans(): ReceivedSpan[] {
      return http.received().flatMap((request) =>
        (
          request.body as {
            resourceSpans: {
              resource: { attributes: Attribute[] };
              scopeSpans: { spans: (Omit<ReceivedSpan, "attributes" | "resource"> & { attributes: Attribute[] })[] }[];
            }[];
          }
        ).resourceSpans.flatMap(({ resource, scopeSpans }) =>
          scopeSpans.flatMap(({ spans }) =>
            spans.map((span) => ({
              ...span,
              attributes: valuesOf(span.attributes),
              resource: valuesOf(resource.attributes),
            })),
          ),
        ),
      );
    },
  };
}

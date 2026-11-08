// Sends the run's spans to an OTLP/HTTP receiver (ADR 0087): OTEL_EXPORTER_OTLP_TRACES_ENDPOINT, or
// OTEL_EXPORTER_OTLP_ENDPOINT with /v1/traces, and the headers of OTEL_EXPORTER_OTLP_HEADERS.

export interface Exporter {
  /** Posts one ExportTraceServiceRequest; rejects when the receiver refuses it or does not answer within 5 seconds. */
  send(request: unknown): Promise<void>;
}

export function exporterOf(env: Record<string, string | undefined>): Exporter | undefined {
  const base = env.OTEL_EXPORTER_OTLP_ENDPOINT?.replace(/\/$/, "");
  const url = env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT || (base && `${base}/v1/traces`);
  if (!url) return undefined;
  const headers: Record<string, string> = { "content-type": "application/json" };
  for (const pair of (env.OTEL_EXPORTER_OTLP_HEADERS ?? "").split(",")) {
    const at = pair.indexOf("=");
    if (at > 0) headers[decodeURIComponent(pair.slice(0, at).trim())] = decodeURIComponent(pair.slice(at + 1).trim());
  }
  return {
    async send(request) {
      const response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(request),
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) throw new Error(`the OTLP receiver at ${url} answered ${response.status}`);
    },
  };
}

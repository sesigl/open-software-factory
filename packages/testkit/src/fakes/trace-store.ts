// A fake trace store on 127.0.0.1 (ADR 0120): an OTLP/HTTP receiver for JSON traces at `POST /v1/traces`, and Jaeger's
// query API `GET /api/traces/{traceId}` over the spans it received. With `keep: false` it takes spans and keeps none,
// like a collector whose exporter to the store is broken.
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";

export interface TraceStoreOptions {
  /** Keep the received spans for the query API. Default true. */
  keep?: boolean;
}

/** One span the fake received, with the name of its resource's service. */
export interface StoredSpan {
  traceId: string;
  spanId: string;
  name: string;
  service: string;
}

export interface TraceStore {
  /** The OTLP/HTTP base URL, without `/v1/traces`. */
  otlpUrl: string;
  /** The base URL of Jaeger's query API, without `/api`. */
  queryUrl: string;
  /** Every span the receiver took, in order, also with `keep: false`. */
  spans(): StoredSpan[];
}

interface OtlpRequest {
  resourceSpans?: {
    resource?: { attributes?: { key: string; value?: { stringValue?: string } }[] };
    scopeSpans?: { spans?: { traceId: string; spanId: string; name: string }[] }[];
  }[];
}

export async function startTraceStore(
  options: TraceStoreOptions = {},
): Promise<{ store: TraceStore; close(): Promise<string[]> }> {
  const received: StoredSpan[] = [];
  const kept: StoredSpan[] = [];
  const unscripted: string[] = [];
  const server = createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("end", () => {
      const answer = (status: number, body: unknown) => {
        response.writeHead(status, { "content-type": "application/json" });
        response.end(JSON.stringify(body));
      };
      const path = request.url ?? "/";
      if (request.method === "POST" && path === "/v1/traces") {
        const body = JSON.parse(Buffer.concat(chunks).toString("utf8")) as OtlpRequest;
        for (const resource of body.resourceSpans ?? []) {
          const service =
            resource.resource?.attributes?.find(({ key }) => key === "service.name")?.value?.stringValue ?? "";
          for (const scope of resource.scopeSpans ?? [])
            for (const { traceId, spanId, name } of scope.spans ?? [])
              received.push({ traceId, spanId, name, service });
        }
        if (options.keep !== false) kept.splice(0, kept.length, ...received);
        return answer(200, {});
      }
      const query = request.method === "GET" ? /^\/api\/traces\/([0-9a-f]+)$/.exec(path) : null;
      if (query?.[1]) {
        const id = query[1];
        const spans = kept.filter(({ traceId }) => traceId === id);
        if (spans.length === 0) return answer(404, { data: null, errors: [{ code: 404, msg: "trace not found" }] });
        const processes = { p1: { serviceName: spans[0]?.service ?? "", tags: [] } };
        const data = spans.map(({ spanId, name }) => ({
          traceID: id,
          spanID: spanId,
          operationName: name,
          processID: "p1",
        }));
        return answer(200, { data: [{ traceID: id, spans: data, processes }] });
      }
      unscripted.push(`${request.method} ${path}`);
      return answer(404, {});
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return {
    store: { otlpUrl: url, queryUrl: url, spans: () => [...received] },
    async close() {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      return unscripted.map((request) => `the fake trace store got an unscripted request: ${request}`);
    },
  };
}

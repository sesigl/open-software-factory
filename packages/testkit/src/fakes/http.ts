// A scripted JSON API on 127.0.0.1 (ADR 0021). It answers only the routes its script names; any other request gets
// HTTP 404 and fails the scenario with the method and path it received.
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { gunzipSync } from "node:zlib";

export interface HttpRoute {
  /** Default `GET`. */
  method?: string;
  /** The exact path with its query, for example `/v0.1/servers?search=tracker`. */
  path: string;
  /** Default 200. */
  status?: number;
  /** The JSON body of the answer, or its text when `contentType` is set. */
  body: unknown;
  /** The content type of a body that is not JSON, for example `text/html`; the body is then sent as is. */
  contentType?: string;
  /** Answer only this many requests; later requests go to the next route that matches. Default: every request. */
  times?: number;
}

/** One request the fake received. */
export interface HttpRequest {
  method: string;
  /** The path with its query. */
  path: string;
  /** The request body as JSON, or as text when it is not JSON; undefined when it is empty. A gzip body is unpacked. */
  body: unknown;
}

export interface FakeHttp {
  /** Base URL without a trailing slash; pass it to the module through its documented config. */
  url: string;
  /** Every request the fake received, in order, as `METHOD /path`. */
  requests(): string[];
  /** Every request the fake received, in order, with its body. */
  received(): HttpRequest[];
  /** Every request the fake received, in order, with its headers; names are lower case. */
  headers(): { method: string; path: string; headers: Record<string, string> }[];
}

export interface RunningHttp {
  http: FakeHttp;
  /** Closes the server and returns one message per unscripted request. */
  close(): Promise<string[]>;
}

export async function startHttp(routes: HttpRoute[]): Promise<RunningHttp> {
  const received: HttpRequest[] = [];
  const headers: { method: string; path: string; headers: Record<string, string> }[] = [];
  const unscripted: string[] = [];
  const scripted = routes.map((route) => ({ route, answered: 0 }));
  const server = createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("end", () => {
      const line = `${request.method} ${request.url}`;
      const raw = Buffer.concat(chunks);
      const body = request.headers["content-encoding"] === "gzip" ? gunzipSync(raw) : raw;
      received.push({ method: request.method ?? "", path: request.url ?? "", body: parse(body) });
      headers.push({
        method: request.method ?? "",
        path: request.url ?? "",
        headers: Object.fromEntries(Object.entries(request.headers).map(([name, value]) => [name, String(value)])),
      });
      const entry = scripted.find(
        ({ route, answered }) =>
          `${route.method ?? "GET"} ${route.path}` === line && (route.times === undefined || answered < route.times),
      );
      const route = entry?.route;
      if (entry) entry.answered += 1;
      else unscripted.push(`unscripted HTTP request: ${line}`);
      response.setHeader("content-type", route?.contentType ?? "application/json");
      response.statusCode = route ? (route.status ?? 200) : 404;
      if (route?.contentType) response.end(String(route.body));
      else response.end(JSON.stringify(route ? route.body : { error: `unscripted HTTP request: ${line}` }));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  return {
    http: {
      url: `http://127.0.0.1:${port}`,
      requests: () => received.map((entry) => `${entry.method} ${entry.path}`),
      received: () => received.map((entry) => ({ ...entry })),
      headers: () => headers.map((entry) => ({ ...entry, headers: { ...entry.headers } })),
    },
    async close() {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      return unscripted;
    },
  };
}

function parse(body: Buffer): unknown {
  if (body.length === 0) return undefined;
  const text = body.toString("utf8");
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

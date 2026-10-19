// A scripted JSON API on 127.0.0.1 (ADR 0021). It answers only the routes its script names; any other request gets
// HTTP 404 and fails the scenario with the method and path it received.
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";

export interface HttpRoute {
  /** Default `GET`. */
  method?: string;
  /** The exact path with its query, for example `/v0.1/servers?search=tracker`. */
  path: string;
  /** Default 200. */
  status?: number;
  /** The JSON body of the answer. */
  body: unknown;
}

export interface FakeHttp {
  /** Base URL without a trailing slash; pass it to the module through its documented config. */
  url: string;
  /** Every request the fake received, in order, as `METHOD /path`. */
  requests(): string[];
}

export interface RunningHttp {
  http: FakeHttp;
  /** Closes the server and returns one message per unscripted request. */
  close(): Promise<string[]>;
}

export async function startHttp(routes: HttpRoute[]): Promise<RunningHttp> {
  const received: string[] = [];
  const unscripted: string[] = [];
  const server = createServer((request, response) => {
    const line = `${request.method} ${request.url}`;
    received.push(line);
    const route = routes.find((entry) => `${entry.method ?? "GET"} ${entry.path}` === line);
    response.setHeader("content-type", "application/json");
    if (!route) unscripted.push(`unscripted HTTP request: ${line}`);
    response.statusCode = route ? (route.status ?? 200) : 404;
    response.end(JSON.stringify(route ? route.body : { error: `unscripted HTTP request: ${line}` }));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  return {
    http: { url: `http://127.0.0.1:${port}`, requests: () => [...received] },
    async close() {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      return unscripted;
    },
  };
}

// sut.http: the module as an HTTP server on a port the testkit picks.
import createClient, { type Client } from "openapi-fetch";
import { type Server, startServer } from "../support/server.ts";
import type { Launch } from "./launch.ts";

export interface HttpResponse {
  status: number;
  headers: Record<string, string>;
  /** Parsed JSON when the response says `application/json`, else the text. */
  body: unknown;
}

export interface Http {
  /**
   * Starts the module's artifact with these arguments and the environment variable `PORT`, and waits until it
   * listens on 127.0.0.1:PORT. Returns the base URL. The server stops when the scenario ends.
   */
  start(args?: string[], options?: { env?: Record<string, string> }): Promise<string>;
  request(
    method: string,
    path: string,
    options?: { body?: unknown; headers?: Record<string, string> },
  ): Promise<HttpResponse>;
  get(path: string): Promise<HttpResponse>;
  post(path: string, body?: unknown): Promise<HttpResponse>;
  /** A client typed by the module's OpenAPI `paths`, as generated from `contracts/` (openapi-fetch). */
  client<Paths extends {}>(): Client<Paths>;
}

export function makeHttp(launch: Launch, onStop: (stop: () => Promise<unknown>) => void): Http {
  let server: Server | undefined;
  const base = (): string => {
    if (!server) throw new Error("sut.http: call sut.http.start() before the first request");
    return `http://127.0.0.1:${server.port}`;
  };
  const http: Http = {
    async start(args = [], options = {}) {
      if (server) throw new Error("sut.http: the server is already running");
      const { command, argv, cwd, env } = launch(args, options.env);
      server = await startServer(command, argv, cwd, env);
      const started = server;
      onStop(() => started.stop());
      return base();
    },
    async request(method, path, options = {}) {
      const response = await fetch(new URL(path, base()), {
        method,
        headers: {
          ...(options.body === undefined ? {} : { "content-type": "application/json" }),
          ...options.headers,
        },
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
      });
      const text = await response.text();
      const json = response.headers.get("content-type")?.includes("application/json");
      return {
        status: response.status,
        headers: Object.fromEntries(response.headers),
        body: json && text ? JSON.parse(text) : text,
      };
    },
    get: (path) => http.request("GET", path),
    post: (path, body) => http.request("POST", path, { body }),
    client: <Paths extends {}>() => createClient<Paths>({ baseUrl: base() }),
  };
  return http;
}

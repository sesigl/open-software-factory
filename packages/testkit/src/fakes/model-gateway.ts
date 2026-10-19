// A scripted, OpenAI-compatible model gateway on 127.0.0.1. It answers only the calls its script names; any other
// call gets HTTP 500 and fails the scenario with the request it received.
import { createServer, type IncomingMessage } from "node:http";
import type { AddressInfo } from "node:net";

export interface ScriptedReply {
  /** The call matches when its JSON body contains this text. */
  when: string;
  /** The assistant message the gateway answers with. */
  reply: string;
}

export interface ModelGateway {
  /** Base URL of the OpenAI-compatible API, ending in `/v1`; pass it to the module through its documented config. */
  url: string;
  /** Every call the gateway received, in order. */
  calls: { path: string; body: string }[];
}

export interface RunningGateway {
  gateway: ModelGateway;
  /** Closes the server and returns one message per unscripted call. */
  close(): Promise<string[]>;
}

/** The fixed `created` time of every reply: 2026-01-01T00:00:00Z. */
const CREATED = 1_767_225_600;

export async function startModelGateway(script: ScriptedReply[]): Promise<RunningGateway> {
  const calls: ModelGateway["calls"] = [];
  const unscripted: string[] = [];
  const server = createServer(async (request, response) => {
    const body = await readBody(request);
    const path = request.url ?? "/";
    calls.push({ path, body });
    const match =
      request.method === "POST" && path === "/v1/chat/completions"
        ? script.find((entry) => body.includes(entry.when))
        : undefined;
    response.setHeader("content-type", "application/json");
    if (!match) {
      unscripted.push(`unscripted model call: ${request.method} ${path}\n${body}`);
      response.statusCode = 500;
      response.end(JSON.stringify({ error: { message: "unscripted model call", type: "testkit" } }));
      return;
    }
    const model = modelOf(body);
    response.end(
      JSON.stringify({
        id: `chatcmpl-${calls.length}`,
        object: "chat.completion",
        created: CREATED,
        model,
        choices: [{ index: 0, message: { role: "assistant", content: match.reply }, finish_reason: "stop" }],
        usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
      }),
    );
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  return {
    gateway: { url: `http://127.0.0.1:${port}/v1`, calls },
    async close() {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      return unscripted;
    },
  };
}

function modelOf(body: string): string {
  try {
    return (JSON.parse(body) as { model?: string }).model ?? "scripted";
  } catch {
    return "scripted";
  }
}

function readBody(request: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => (body += chunk));
    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}

// A scripted model gateway on 127.0.0.1 with an OpenAI-compatible chat completions API and the Anthropic Messages
// API (ADR 0051). It answers only the calls its script names; any other call fails the scenario with the request it
// received.
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";

export interface ScriptedTool {
  /** The name of the tool the model calls, for example "Write". */
  name: string;
  /** The input of the call. */
  input: Record<string, unknown>;
}

export interface ScriptedReply {
  /** The call matches when its JSON body contains this text. */
  when: string;
  /** The assistant message the gateway answers with; an empty text sends no text block on the Messages API. */
  reply: string;
  /** The token usage the reply reports. Default: 0 prompt and 0 completion tokens. */
  usage?: { prompt_tokens: number; completion_tokens: number };
  /** Messages API: the tool calls the model asks for after its text, in order. */
  tools?: ScriptedTool[];
  /** Messages API: the stop reason; by default "tool_use" with tool calls and "end_turn" without. */
  stopReason?: string;
  /** Messages API: the gateway never answers the call, so the caller has to give up. */
  hangs?: boolean;
}

export interface ModelGateway {
  /** Base URL of the OpenAI-compatible API, ending in `/v1`; pass it to the module through its documented config. */
  url: string;
  /** Base URL of the Anthropic Messages API, without `/v1`, as `ANTHROPIC_BASE_URL` takes it. */
  anthropicUrl: string;
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
  // A Messages call takes the first matching entry that has not answered one yet, so a tool loop scripts one entry
  // per model call. When every matching entry has answered, the last of them answers again.
  const answered = new Set<ScriptedReply>();
  const messagesReply = (body: string): ScriptedReply | undefined => {
    const matching = script.filter((entry) => body.includes(entry.when));
    const next = matching.find((entry) => !answered.has(entry)) ?? matching.at(-1);
    if (next) answered.add(next);
    return next;
  };
  let toolCalls = 0;
  const server = createServer(async (request, response) => {
    const body = await readBody(request);
    const path = request.url ?? "/";
    calls.push({ path, body });
    const route = request.method === "POST" ? path.split("?")[0] : undefined;
    if (route === "/v1/messages") {
      const match = messagesReply(body);
      if (!match) {
        unscripted.push(`unscripted model call: ${request.method} ${path}\n${body}`);
        // 400, not 500: an Anthropic client retries a server error, but not a request it got wrong.
        response.writeHead(400, { "content-type": "application/json" });
        response.end(
          JSON.stringify({ type: "error", error: { type: "invalid_request_error", message: "unscripted" } }),
        );
        return;
      }
      if (match.hangs) return;
      answerMessages(response, body, match, `msg_${calls.length}`, () => `toolu_${++toolCalls}`);
      return;
    }
    const match = route === "/v1/chat/completions" ? script.find((entry) => body.includes(entry.when)) : undefined;
    response.setHeader("content-type", "application/json");
    if (!match) {
      unscripted.push(`unscripted model call: ${request.method} ${path}\n${body}`);
      response.statusCode = 500;
      response.end(JSON.stringify({ error: { message: "unscripted model call", type: "testkit" } }));
      return;
    }
    response.end(
      JSON.stringify({
        id: `chatcmpl-${calls.length}`,
        object: "chat.completion",
        created: CREATED,
        model: modelOf(body),
        choices: [{ index: 0, message: { role: "assistant", content: match.reply }, finish_reason: "stop" }],
        usage: usageOf(match.usage),
      }),
    );
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  return {
    gateway: { url: `http://127.0.0.1:${port}/v1`, anthropicUrl: `http://127.0.0.1:${port}`, calls },
    async close() {
      // A call that hangs keeps its connection open; close it, or the server never closes.
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      return unscripted;
    },
  };
}

type Block = { type: "text"; text: string } | { type: "tool_use"; id: string; name: string; input: unknown };

/** Answers a Messages API call with the entry's text and tool calls, as a stream when the call asks for one. */
function answerMessages(
  response: ServerResponse,
  body: string,
  entry: ScriptedReply,
  id: string,
  toolId: () => string,
): void {
  const blocks: Block[] = [
    ...(entry.reply ? [{ type: "text" as const, text: entry.reply }] : []),
    ...(entry.tools ?? []).map((tool) => ({ type: "tool_use" as const, id: toolId(), ...tool })),
  ];
  const stopReason = entry.stopReason ?? (entry.tools?.length ? "tool_use" : "end_turn");
  const { prompt_tokens: input, completion_tokens: output } = entry.usage ?? { prompt_tokens: 0, completion_tokens: 0 };
  const message = { id, type: "message", role: "assistant", model: modelOf(body) };
  if (!streams(body)) {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(
      JSON.stringify({
        ...message,
        content: blocks,
        stop_reason: stopReason,
        stop_sequence: null,
        usage: { input_tokens: input, output_tokens: output },
      }),
    );
    return;
  }
  response.writeHead(200, { "content-type": "text/event-stream" });
  const event = (type: string, data: Record<string, unknown>): void => {
    response.write(`event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`);
  };
  event("message_start", {
    message: {
      ...message,
      content: [],
      stop_reason: null,
      stop_sequence: null,
      usage: { input_tokens: input, output_tokens: 0 },
    },
  });
  blocks.forEach((block, index) => {
    if (block.type === "text") {
      event("content_block_start", { index, content_block: { type: "text", text: "" } });
      event("content_block_delta", { index, delta: { type: "text_delta", text: block.text } });
    } else {
      event("content_block_start", { index, content_block: { ...block, input: {} } });
      event("content_block_delta", {
        index,
        delta: { type: "input_json_delta", partial_json: JSON.stringify(block.input) },
      });
    }
    event("content_block_stop", { index });
  });
  event("message_delta", { delta: { stop_reason: stopReason, stop_sequence: null }, usage: { output_tokens: output } });
  event("message_stop", {});
  response.end();
}

function usageOf(usage: ScriptedReply["usage"] = { prompt_tokens: 0, completion_tokens: 0 }) {
  return { ...usage, total_tokens: usage.prompt_tokens + usage.completion_tokens };
}

function parsed(body: string): { model?: string; stream?: boolean } {
  try {
    return JSON.parse(body) as { model?: string; stream?: boolean };
  } catch {
    return {};
  }
}

const modelOf = (body: string): string => parsed(body).model ?? "scripted";
const streams = (body: string): boolean => parsed(body).stream === true;

function readBody(request: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => (body += chunk));
    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}

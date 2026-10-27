// A scripted model gateway on 127.0.0.1, or on every interface for containers (ADR 0054), with an OpenAI-compatible chat completions API, the OpenAI Responses API and
// the Anthropic Messages API (ADR 0052, ADR 0053). It answers only the calls its script names; any other call fails the
// scenario with the request it received.
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";

export interface ScriptedTool {
  /** The name of the tool the model calls, for example "Write". */
  name: string;
  /** The input of the call. On the Responses API a text input is a custom tool call, such as Codex's apply_patch. */
  input: Record<string, unknown> | string;
}

export interface ScriptedReply {
  /** The call matches when its JSON body contains this text. */
  when: string;
  /** The assistant message the gateway answers with; an empty text sends no text block on the Messages API. */
  reply: string;
  /** The token usage the reply reports. Default: 0 prompt and 0 completion tokens. */
  usage?: { prompt_tokens: number; completion_tokens: number };
  /** Streamed calls: the tool calls the model asks for after its text, in order. */
  tools?: ScriptedTool[];
  /**
   * Messages API and streamed chat completions: the stop reason, for example "refusal" or "content_filter". By default
   * "tool_use" or "tool_calls" with tool calls, and "end_turn" or "stop" without.
   */
  stopReason?: string;
  /** Streamed calls: the gateway never answers the call, so the caller has to give up. */
  hangs?: boolean;
}

export interface ModelGateway {
  /** Base URL of the OpenAI-compatible API, ending in `/v1`; pass it to the module through its documented config. */
  url: string;
  /** Base URL of the Anthropic Messages API, without `/v1`, as `ANTHROPIC_BASE_URL` takes it. */
  anthropicUrl: string;
  /**
   * With `containers: true`, the OpenAI-compatible base URL as a container reaches it:
   * `http://host.docker.internal:<port>/v1`. On Linux a container needs `--add-host host.docker.internal:host-gateway`.
   */
  containerUrl?: string;
  /** Every call the gateway received, in order. */
  calls: { path: string; body: string }[];
}

export interface ModelGatewayOptions {
  /** Also answer containers: listen on every interface instead of 127.0.0.1 and give `containerUrl`. Default false. */
  containers?: boolean;
}

export interface RunningGateway {
  gateway: ModelGateway;
  /** Closes the server and returns one message per unscripted call. */
  close(): Promise<string[]>;
}

/** The fixed `created` time of every reply: 2026-01-01T00:00:00Z. */
const CREATED = 1_767_225_600;

export async function startModelGateway(
  script: ScriptedReply[],
  options: ModelGatewayOptions = {},
): Promise<RunningGateway> {
  const calls: ModelGateway["calls"] = [];
  const unscripted: string[] = [];
  // A streamed call (Messages, Responses, streamed chat completions) takes the first matching entry that has not
  // answered one yet, so a tool loop scripts one entry per model call. When every matching entry has answered, the
  // last of them answers again.
  const answered = new Set<ScriptedReply>();
  const nextReply = (body: string): ScriptedReply | undefined => {
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
    const answer = route && streamedAnswers[route];
    if (answer && (route !== "/v1/chat/completions" || streams(body))) {
      const match = nextReply(body);
      if (!match) {
        unscripted.push(`unscripted model call: ${request.method} ${path}\n${body}`);
        // 400, not 500: an Anthropic or OpenAI client retries a server error, but not a request it got wrong.
        response.writeHead(400, { "content-type": "application/json" });
        response.end(
          JSON.stringify({ type: "error", error: { type: "invalid_request_error", message: "unscripted" } }),
        );
        return;
      }
      if (match.hangs) return;
      answer(response, body, match, `${calls.length}`, () => `${++toolCalls}`);
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
  await new Promise<void>((resolve) => server.listen(0, options.containers ? "0.0.0.0" : "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  const containerUrl = options.containers ? { containerUrl: `http://host.docker.internal:${port}/v1` } : {};
  return {
    gateway: { url: `http://127.0.0.1:${port}/v1`, anthropicUrl: `http://127.0.0.1:${port}`, ...containerUrl, calls },
    async close() {
      // A call that hangs keeps its connection open; close it, or the server never closes.
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      return unscripted;
    },
  };
}

/** Answers one scripted call: the response, the call's body, the entry, a number for the reply's ID, tool call IDs. */
type Answer = (response: ServerResponse, body: string, entry: ScriptedReply, id: string, toolId: () => string) => void;

type Block = { type: "text"; text: string } | { type: "tool_use"; id: string; name: string; input: unknown };

/** Writes one server-sent event; `named` adds the event's type as its `event:` line. */
function sse(response: ServerResponse, data: Record<string, unknown>, named = true): void {
  response.write(`${named ? `event: ${data.type}\n` : ""}data: ${JSON.stringify(data)}\n\n`);
}

/** Answers a Messages API call with the entry's text and tool calls, as a stream when the call asks for one. */
const answerMessages: Answer = (response, body, entry, id, toolId) => {
  const blocks: Block[] = [
    ...(entry.reply ? [{ type: "text" as const, text: entry.reply }] : []),
    ...(entry.tools ?? []).map((tool) => ({ type: "tool_use" as const, id: `toolu_${toolId()}`, ...tool })),
  ];
  const stopReason = entry.stopReason ?? (entry.tools?.length ? "tool_use" : "end_turn");
  const { prompt_tokens: input, completion_tokens: output } = entry.usage ?? { prompt_tokens: 0, completion_tokens: 0 };
  const message = { id: `msg_${id}`, type: "message", role: "assistant", model: modelOf(body) };
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
  const event = (type: string, data: Record<string, unknown>): void => sse(response, { type, ...data });
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
};

/**
 * Answers a Responses API call as a stream: the entry's text as a message, then a function call for each tool with an
 * object input and a custom tool call for each tool with a text input, then the usage.
 */
const answerResponses: Answer = (response, _body, entry, id, toolId) => {
  const output: Record<string, unknown>[] = [
    ...(entry.reply
      ? [
          {
            type: "message",
            id: `msg_${id}`,
            role: "assistant",
            content: [{ type: "output_text", text: entry.reply, annotations: [] }],
          },
        ]
      : []),
    ...(entry.tools ?? []).map((tool) => {
      const n = toolId();
      return typeof tool.input === "string"
        ? { type: "custom_tool_call", id: `ctc_${n}`, call_id: `call_${n}`, name: tool.name, input: tool.input }
        : {
            type: "function_call",
            id: `fc_${n}`,
            call_id: `call_${n}`,
            name: tool.name,
            arguments: JSON.stringify(tool.input),
          };
    }),
  ];
  const { prompt_tokens: input, completion_tokens: outputTokens } = entry.usage ?? {
    prompt_tokens: 0,
    completion_tokens: 0,
  };
  response.writeHead(200, { "content-type": "text/event-stream" });
  sse(response, { type: "response.created", response: { id: `resp_${id}` } });
  output.forEach((item, index) => {
    const message = item.type === "message";
    sse(response, {
      type: "response.output_item.added",
      output_index: index,
      item: message ? { ...item, content: [] } : item,
    });
    // A client shows a message's text from its deltas.
    if (message) {
      const delta = { item_id: item.id, output_index: index, content_index: 0, delta: entry.reply };
      sse(response, { type: "response.output_text.delta", ...delta });
    }
    sse(response, { type: "response.output_item.done", output_index: index, item });
  });
  const usage = {
    input_tokens: input,
    output_tokens: outputTokens,
    total_tokens: input + outputTokens,
    input_tokens_details: { cached_tokens: 0 },
    output_tokens_details: { reasoning_tokens: 0 },
  };
  sse(response, { type: "response.completed", response: { id: `resp_${id}`, output, usage } });
  response.end();
};

/** Answers a streamed chat completions call with the entry's text, its tool calls, the finish reason and the usage. */
const answerChat: Answer = (response, body, entry, id, toolId) => {
  const base = { id: `chatcmpl-${id}`, object: "chat.completion.chunk", created: CREATED, model: modelOf(body) };
  const chunk = (delta: Record<string, unknown>, finish: string | null = null): void =>
    sse(response, { ...base, choices: [{ index: 0, delta, finish_reason: finish }] }, false);
  response.writeHead(200, { "content-type": "text/event-stream" });
  chunk({ role: "assistant", content: entry.reply });
  (entry.tools ?? []).forEach((tool, index) => {
    const call = { name: tool.name, arguments: JSON.stringify(tool.input) };
    chunk({ tool_calls: [{ index, id: `call_${toolId()}`, type: "function", function: call }] });
  });
  chunk({}, entry.stopReason ?? (entry.tools?.length ? "tool_calls" : "stop"));
  sse(response, { ...base, choices: [], usage: usageOf(entry.usage) }, false);
  response.write("data: [DONE]\n\n");
  response.end();
};

/** The routes whose calls take the next unanswered entry; chat completions only when the call streams. */
const streamedAnswers: Record<string, Answer> = {
  "/v1/messages": answerMessages,
  "/v1/responses": answerResponses,
  "/v1/chat/completions": answerChat,
};

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

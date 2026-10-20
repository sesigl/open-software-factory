// A Codex rollout file: ~/.codex/sessions/<yyyy>/<mm>/<dd>/rollout-*.jsonl, one {timestamp, type, payload} per line.
// Each model response ends with a token_count event; Codex sometimes repeats that event with the same totals.
import { type Message, NO_USAGE, type Response, type Session, type ToolCall, textOf, type Usage } from "./session.ts";

// biome-ignore lint/suspicious/noExplicitAny: session lines are external JSON of many shapes.
type Line = Record<string, any>;

export const isCodex = (lines: Line[]): boolean => lines.some((line) => line.type === "session_meta");

const usageOf = (usage: Line): Usage => ({
  input: usage.input_tokens ?? 0,
  output: usage.output_tokens ?? 0,
  cacheRead: usage.cached_input_tokens ?? 0,
  cacheWrite: 0,
});

export function codexSession(lines: Line[]): Session {
  const meta = lines.find((line) => line.type === "session_meta") as Line;
  const responses: Response[] = [];
  const tools = new Map<string, ToolCall>();
  let model = "";
  let input: Message[] = [];
  let output: Message[] = [];
  let total = NO_USAGE;
  let totalTokens = -1;
  let previous = meta.timestamp as string;
  for (const { timestamp, type, payload = {} } of lines) {
    if (type === "turn_context") model = payload.model;
    if (type === "response_item" && payload.type === "message") {
      const message = { role: payload.role, text: textOf(payload.content) };
      (payload.role === "user" ? input : output).push(message);
    }
    if (type === "response_item" && /^(function|custom_tool)_call$/.test(payload.type)) {
      const call = { id: payload.call_id, name: payload.name, start: timestamp, end: timestamp };
      tools.set(payload.call_id, { ...call, arguments: payload.arguments ?? payload.input, result: "" });
    }
    const call = /_call_output$/.test(payload.type) ? tools.get(payload.call_id) : undefined;
    if (call) Object.assign(call, { end: timestamp, result: textOf(payload.output) });
    const info = type === "event_msg" && payload.type === "token_count" ? payload.info : undefined;
    if (info && info.total_token_usage.total_tokens !== totalTokens) {
      totalTokens = info.total_token_usage.total_tokens;
      total = usageOf(info.total_token_usage);
      responses.push({ model, start: previous, end: timestamp, usage: usageOf(info.last_token_usage), input, output });
      input = [];
      output = [];
      previous = timestamp;
    }
  }
  return {
    harness: "codex",
    harnessVersion: meta.payload.cli_version,
    provider: "openai",
    conversationId: meta.payload.id,
    start: meta.timestamp,
    end: (lines.at(-1) as Line).timestamp,
    usage: total,
    responses,
    tools: [...tools.values()],
  };
}

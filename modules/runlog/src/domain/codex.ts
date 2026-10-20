// A Codex rollout file: ~/.codex/sessions/<yyyy>/<mm>/<dd>/rollout-*.jsonl, one {timestamp, type, payload} per line.
// Each model response ends with a token_count event; Codex sometimes repeats that event with the same totals.
import {
  type Message,
  NO_USAGE,
  type Response,
  type Session,
  type ToolCall,
  textOf,
  type Usage,
  type Write,
} from "./session.ts";

// biome-ignore lint/suspicious/noExplicitAny: session lines are external JSON of many shapes.
type Line = Record<string, any>;

export const isCodex = (lines: Line[]): boolean => lines.some((line) => line.type === "session_meta");

const usageOf = (usage: Line): Usage => ({
  input: usage.input_tokens ?? 0,
  output: usage.output_tokens ?? 0,
  cacheRead: usage.cached_input_tokens ?? 0,
  cacheWrite: 0,
});

/** The added lines of each file in an apply_patch patch, one Write per block of consecutive "+" lines. */
function patchWrites(patch: string): Write[] {
  const writes: Write[] = [];
  let path = "";
  let block: string[] = [];
  const flush = () => {
    if (path && block.length) writes.push({ path, text: block.join("\n") });
    block = [];
  };
  for (const line of patch.split("\n")) {
    const file = line.match(/^\*\*\* (?:Add|Update) File: (.+)$/);
    if (file || !line.startsWith("+")) flush();
    if (file) path = file[1] as string;
    else if (line.startsWith("+")) block.push(line.slice(1));
  }
  flush();
  return writes;
}

export function codexSession(lines: Line[]): Session {
  const meta = lines.find((line) => line.type === "session_meta") as Line;
  const responses: Response[] = [];
  const tools = new Map<string, ToolCall>();
  const writes: Write[] = [];
  let model = "";
  let first = "";
  let input: Message[] = [];
  let output: Message[] = [];
  let total = NO_USAGE;
  let totalTokens = -1;
  let previous = meta.timestamp as string;
  for (const { timestamp, type, payload = {} } of lines) {
    if (type === "turn_context") model = payload.model;
    first ||= model;
    if (type === "response_item" && payload.type === "message") {
      const message = { role: payload.role, text: textOf(payload.content) };
      (payload.role === "user" ? input : output).push(message);
    }
    if (type === "response_item" && /^(function|custom_tool)_call$/.test(payload.type)) {
      const call = { id: payload.call_id, name: payload.name, start: timestamp, end: timestamp };
      tools.set(payload.call_id, { ...call, arguments: payload.arguments ?? payload.input, result: "" });
      if (payload.name === "apply_patch") writes.push(...patchWrites(payload.input ?? ""));
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
    model: first,
    conversationId: meta.payload.id,
    cwd: meta.payload.cwd,
    start: meta.timestamp,
    end: (lines.at(-1) as Line).timestamp,
    usage: total,
    responses,
    tools: [...tools.values()],
    writes,
  };
}

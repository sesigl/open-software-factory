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

// The response items of a tool call and of its output; apply_patch is a custom tool call.
const CALLS = new Set(["function_call", "custom_tool_call"]);
const OUTPUTS = new Set(["function_call_output", "custom_tool_call_output"]);

/** The added lines of each file in an apply_patch patch, one Write per block of consecutive "+" lines. */
function patchWrites(patch: string): Write[] {
  const writes: Write[] = [];
  let path = "";
  // The write of the "+" lines right above the current line.
  let open: Write | undefined;
  for (const line of patch.split("\n")) {
    path = line.match(/^\*\*\* (?:Add|Update) File: (.+)/)?.[1] ?? path;
    if (!line.startsWith("+")) open = undefined;
    else if (open) open.text += `\n${line.slice(1)}`;
    else {
      open = { path, text: line.slice(1) };
      writes.push(open);
    }
  }
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
  let totalTokens: number | undefined;
  let previous = meta.timestamp as string;
  for (const { timestamp, type, payload = {} } of lines) {
    if (type === "turn_context") model = payload.model;
    first ||= model;
    if (payload.type === "message") {
      const message = { role: payload.role, text: textOf(payload.content) };
      (payload.role === "user" ? input : output).push(message);
    }
    if (CALLS.has(payload.type)) {
      const call = { id: payload.call_id, name: payload.name, start: timestamp, end: timestamp };
      tools.set(payload.call_id, { ...call, arguments: payload.arguments ?? payload.input, result: "" });
      if (payload.name === "apply_patch") writes.push(...patchWrites(payload.input ?? ""));
    }
    const call = OUTPUTS.has(payload.type) ? tools.get(payload.call_id) : undefined;
    if (call) Object.assign(call, { end: timestamp, result: textOf(payload.output) });
    const info = payload.type === "token_count" ? payload.info : undefined;
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

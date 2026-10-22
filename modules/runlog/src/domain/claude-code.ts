// A Claude Code session file: ~/.claude/projects/<project>/<session>.jsonl, one JSON object per line. Claude Code
// writes each content block of a response on its own line; the lines of one response share its message ID and
// repeat its usage.
import {
  type Message,
  NO_USAGE,
  type Response,
  type Session,
  sum,
  type ToolCall,
  textOf,
  type Usage,
  type Write,
} from "./session.ts";

// biome-ignore lint/suspicious/noExplicitAny: session lines are external JSON of many shapes.
type Line = Record<string, any>;

// A subagent's transcript repeats the parent's session ID with isSidechain set; it belongs to the parent's run.
const isMessage = (line: Line): boolean =>
  typeof line.sessionId === "string" && (line.type === "user" || line.type === "assistant") && !line.isSidechain;

export const isClaudeCode = (lines: Line[]): boolean => lines.some(isMessage);

const usageOf = (usage: Line = {}): Usage => {
  const cacheRead = usage.cache_read_input_tokens ?? 0;
  const cacheWrite = usage.cache_creation_input_tokens ?? 0;
  return {
    input: (usage.input_tokens ?? 0) + cacheRead + cacheWrite,
    output: usage.output_tokens ?? 0,
    cacheRead,
    cacheWrite,
  };
};

/** The text that an Edit, MultiEdit or Write call wrote. */
function writesOf(name: string, input: Line = {}): Write[] {
  const path = input.file_path as string;
  if (name === "Write") return [{ path, text: input.content }];
  if (name === "Edit") return [{ path, text: input.new_string }];
  if (name === "MultiEdit") return (input.edits ?? []).map((edit: Line) => ({ path, text: edit.new_string }));
  return [];
}

export function claudeCodeSession(lines: Line[]): Session {
  const messages = lines.filter(isMessage);
  const first = messages[0] as Line;
  const responses = new Map<string, Response>();
  const tools = new Map<string, ToolCall>();
  const writes: Write[] = [];
  let pending: Message[] = [];
  let previous = first.timestamp as string;
  for (const line of messages) {
    const content = line.message.content;
    const blocks: Line[] = Array.isArray(content) ? content : [];
    if (line.type === "user") {
      // Tool results carry their text in `content`, so the text of the line is the prompt alone.
      const text = textOf(content);
      if (text) pending.push({ role: "user", text });
      for (const block of blocks) {
        const call = tools.get(block.tool_use_id);
        if (call) Object.assign(call, { end: line.timestamp, result: textOf(block.content) });
      }
    } else {
      const id = line.message.id as string;
      const response: Response = responses.get(id) ?? {
        id,
        model: line.message.model,
        start: previous,
        end: line.timestamp,
        usage: usageOf(line.message.usage),
        input: pending,
        output: [],
      };
      pending = [];
      response.end = line.timestamp;
      const text = textOf(content);
      if (text) response.output.push({ role: "assistant", text });
      responses.set(id, response);
      for (const block of blocks.filter((part) => part.type === "tool_use")) {
        const call = { id: block.id, name: block.name, start: line.timestamp, end: line.timestamp };
        tools.set(block.id, { ...call, arguments: JSON.stringify(block.input), result: "" });
        writes.push(...writesOf(block.name, block.input));
      }
    }
    previous = line.timestamp;
  }
  const all = [...responses.values()];
  return {
    harness: "claude-code",
    harnessVersion: first.version,
    provider: "anthropic",
    model: all[0]?.model ?? "",
    conversationId: first.sessionId,
    cwd: first.cwd,
    start: first.timestamp,
    end: previous,
    usage: all.reduce((total, response) => sum(total, response.usage), NO_USAGE),
    responses: all,
    tools: [...tools.values()],
    writes,
  };
}

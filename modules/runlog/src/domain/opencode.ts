// An OpenCode session as "opencode export <session id>" prints it: {info, messages: [{info, parts}]}. Times are epoch
// milliseconds. An assistant message's tokens.input leaves out cached tokens; tool parts carry their own start and end.
import { type Message, NO_USAGE, type Response, type Session, sum, type ToolCall, type Write } from "./session.ts";

// biome-ignore lint/suspicious/noExplicitAny: the export is external JSON of many shapes.
type Json = Record<string, any>;

export const isOpenCode = (document: Json): boolean =>
  typeof document.info?.id === "string" && Array.isArray(document.messages);

const iso = (millis: number): string => new Date(millis).toISOString();

const texts = (parts: Json[], role: Message["role"]): Message[] =>
  parts.filter((part) => part.type === "text" && part.text).map((part) => ({ role, text: part.text }));

/** The text that an edit or write call wrote. */
function writesOf(tool: string, input: Json = {}): Write[] {
  if (tool === "write") return [{ path: input.filePath, text: input.content }];
  if (tool === "edit") return [{ path: input.filePath, text: input.newString }];
  return [];
}

export function openCodeSession(document: Json): Session {
  const responses: Response[] = [];
  const tools: ToolCall[] = [];
  const writes: Write[] = [];
  let provider = "";
  let pending: Message[] = [];
  for (const { info, parts = [] } of document.messages as Json[]) {
    if (info.role === "user") {
      pending.push(...texts(parts, "user"));
      continue;
    }
    const tokens = info.tokens ?? {};
    const cacheRead = tokens.cache?.read ?? 0;
    const cacheWrite = tokens.cache?.write ?? 0;
    provider ||= info.providerID;
    responses.push({
      id: info.id,
      model: info.modelID,
      start: iso(info.time.created),
      end: iso(info.time.completed ?? info.time.created),
      usage: { input: (tokens.input ?? 0) + cacheRead + cacheWrite, output: tokens.output ?? 0, cacheRead, cacheWrite },
      input: pending,
      output: texts(parts, "assistant"),
    });
    pending = [];
    for (const part of parts.filter((one: Json) => one.type === "tool")) {
      const { input, output, error, time } = part.state ?? {};
      const start = iso(time?.start ?? info.time.created);
      const end = time?.end ? iso(time.end) : start;
      tools.push({
        id: part.callID,
        name: part.tool,
        start,
        end,
        arguments: JSON.stringify(input),
        result: output ?? error ?? "",
      });
      writes.push(...writesOf(part.tool, input));
    }
  }
  const { info } = document;
  return {
    harness: "opencode",
    harnessVersion: info.version,
    provider,
    model: responses[0]?.model ?? "",
    conversationId: info.id,
    cwd: info.directory,
    start: iso(info.time.created),
    end: iso(info.time.updated),
    usage: responses.reduce((total, response) => sum(total, response.usage), NO_USAGE),
    responses,
    tools,
    writes,
  };
}

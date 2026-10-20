// One harness session, read from its session file, in the shape every harness maps to.

export interface Usage {
  /** Every input token, cached ones included (GenAI conventions). */
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
}

export interface Message {
  role: "user" | "assistant";
  text: string;
}

/** One answer of the model. */
export interface Response {
  /** The provider's response ID, when the session file has one. */
  id?: string;
  model: string;
  start: string;
  end: string;
  usage: Usage;
  /** The user messages since the response before. */
  input: Message[];
  output: Message[];
}

export interface ToolCall {
  id: string;
  name: string;
  start: string;
  end: string;
  arguments: string;
  result: string;
}

export interface Session {
  harness: "claude-code" | "codex";
  harnessVersion?: string;
  provider: "anthropic" | "openai";
  conversationId: string;
  start: string;
  end: string;
  usage: Usage;
  responses: Response[];
  tools: ToolCall[];
}

export const NO_USAGE: Usage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };

export const sum = (a: Usage, b: Usage): Usage => ({
  input: a.input + b.input,
  output: a.output + b.output,
  cacheRead: a.cacheRead + b.cacheRead,
  cacheWrite: a.cacheWrite + b.cacheWrite,
});

/** The text of a content field: a string, or the text blocks of a list of content blocks. */
export function textOf(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .filter((block) => typeof block?.text === "string")
    .map((block) => block.text as string)
    .join("\n");
}

// Which harness wrote a session file.
import { claudeCodeSession, isClaudeCode } from "./claude-code.ts";
import { codexSession, isCodex } from "./codex.ts";
import { isOpenCode, openCodeSession } from "./opencode.ts";
import type { Session } from "./session.ts";

const parse = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
};

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

/** The session in a file's text, or undefined when no harness runlog knows wrote it. */
export function sessionOf(text: string): Session | undefined {
  const whole = parse(text);
  if (isObject(whole) && isOpenCode(whole)) return openCodeSession(whole);
  const lines = text.split("\n").map(parse).filter(isObject);
  if (isCodex(lines)) return codexSession(lines);
  if (isClaudeCode(lines)) return claudeCodeSession(lines);
  return undefined;
}

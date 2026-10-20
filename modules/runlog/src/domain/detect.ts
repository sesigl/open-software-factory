// Which harness wrote a session file.
import { claudeCodeSession, isClaudeCode } from "./claude-code.ts";
import { codexSession, isCodex } from "./codex.ts";
import type { Session } from "./session.ts";

/** The session in a JSONL file's text, or undefined when no harness runlog knows wrote it. */
export function sessionOf(text: string): Session | undefined {
  const lines = text
    .split("\n")
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return undefined;
      }
    })
    .filter((line) => typeof line === "object" && line !== null);
  if (isCodex(lines)) return codexSession(lines);
  if (isClaudeCode(lines)) return claudeCodeSession(lines);
  return undefined;
}

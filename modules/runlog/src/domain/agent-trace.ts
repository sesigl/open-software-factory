// The Agent Trace record of a run (https://agent-trace.dev, version 0.1.0): the line ranges of the files as they are
// now that hold text the session wrote, attributed to the contributor "ai" and the session's model. Text that is no
// longer in a file is not attributed; text that occurs twice is attributed at its first place.
import { isAbsolute, relative } from "node:path";
import type { Session } from "./session.ts";

interface Range {
  start_line: number;
  end_line: number;
}

export interface AgentTrace {
  version: "0.1.0";
  id: string;
  timestamp: string;
  vcs?: { type: "git"; revision: string };
  tool: { name: string; version?: string };
  files: { path: string; conversations: { contributor: { type: "ai"; model_id: string }; ranges: Range[] }[] }[];
}

/** The path of a written file relative to the session's folder, or undefined when it is outside of it. */
function pathIn(session: Session, path: string): string | undefined {
  const inside = typeof path !== "string" ? "" : isAbsolute(path) ? relative(session.cwd ?? "/", path) : path;
  return inside && !inside.startsWith("..") && !isAbsolute(inside) ? inside : undefined;
}

/** The lines of `content` that hold `text`, or undefined when it does not. */
function rangeOf(content: string, text: string): Range | undefined {
  const at = content.indexOf(text);
  if (at < 0) return undefined;
  const start = content.slice(0, at).split("\n").length;
  return { start_line: start, end_line: start + text.split("\n").length - 1 };
}

/** Sorted ranges with overlapping and touching ones joined. */
function joined(ranges: Range[]): Range[] {
  const sorted = [...ranges].sort((a, b) => a.start_line - b.start_line);
  const result: Range[] = [];
  for (const range of sorted) {
    const last = result.at(-1);
    if (last && range.start_line <= last.end_line + 1) last.end_line = Math.max(last.end_line, range.end_line);
    else result.push({ ...range });
  }
  return result;
}

/**
 * The record for the session. `read` gives the content of a file relative to the repository as it is now, or
 * undefined; `traceId` gives the record its ID and `revision` is the commit the ranges refer to.
 */
export function agentTraceOf(
  session: Session,
  read: (path: string) => string | undefined,
  traceId: string,
  revision: string | undefined,
): AgentTrace {
  const ranges = new Map<string, Range[]>();
  for (const write of session.writes) {
    const path = pathIn(session, write.path);
    const text = write.text?.replace(/\n+$/, "");
    const content = path && text?.trim() ? read(path) : undefined;
    const range = path && text && content !== undefined ? rangeOf(content, text) : undefined;
    if (path && range) ranges.set(path, [...(ranges.get(path) ?? []), range]);
  }
  const contributor = { type: "ai" as const, model_id: `${session.provider}/${session.model}` };
  return {
    version: "0.1.0",
    id: traceId.replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, "$1-$2-$3-$4-$5"),
    timestamp: session.end,
    ...(revision ? { vcs: { type: "git" as const, revision } } : {}),
    tool: { name: session.harness, ...(session.harnessVersion ? { version: session.harnessVersion } : {}) },
    files: [...ranges.keys()].sort().map((path) => ({
      path,
      conversations: [{ contributor, ranges: joined(ranges.get(path) ?? []) }],
    })),
  };
}

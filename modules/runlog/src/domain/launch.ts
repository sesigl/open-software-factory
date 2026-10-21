// What a launcher hands runlog: the W3C trace context of the stage, and the time that decides whether a session ended.
import type { Session } from "./session.ts";

// version-traceid-parentid-flags; a trace ID or parent ID of only zeros names no trace.
const TRACEPARENT = /^[0-9a-f]{2}-(?!0{32})([0-9a-f]{32})-(?!0{16})([0-9a-f]{16})-[0-9a-f]{2}$/;

/** The trace and span in a W3C traceparent, or undefined when the value is none or names no trace. */
export function parentOf(traceparent: string | undefined): { traceId: string; spanId: string } | undefined {
  const match = TRACEPARENT.exec(String(traceparent));
  return match ? { traceId: match[1] as string, spanId: match[2] as string } : undefined;
}

/** A session has ended when its last event is at least `idleMinutes` before `now`. */
export const hasEnded = (session: Session, now: number, idleMinutes: number): boolean =>
  now - Date.parse(session.end) >= idleMinutes * 60_000;

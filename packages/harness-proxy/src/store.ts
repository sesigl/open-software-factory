// The session records in the adapter's data folder: <data>/sessions/<session ID>.jsonl.
import { appendFileSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { detectResources, envDetector } from "@opentelemetry/resources";
import type { SessionLine } from "./domain/session.ts";

const fileOf = (data: string, sessionId: string): string =>
  join(resolve(data), "sessions", `${encodeURIComponent(sessionId)}.jsonl`);

export function append(data: string, sessionId: string, line: SessionLine): void {
  const file = fileOf(data, sessionId);
  mkdirSync(dirname(file), { recursive: true });
  appendFileSync(file, `${JSON.stringify(line)}\n`);
}

/** The text of a session's record; a session the proxy never ran is an error. */
export const readSession = (data: string, sessionId: string): string => readFileSync(fileOf(data, sessionId), "utf8");

/** The resource of the run from OTEL_RESOURCE_ATTRIBUTES and OTEL_SERVICE_NAME, as the OpenTelemetry SDK reads them. */
export function resourceOfEnvironment(): Record<string, string> {
  const { attributes } = detectResources({ detectors: [envDetector] });
  return Object.fromEntries(Object.entries(attributes).map(([key, value]) => [key, String(value)]));
}

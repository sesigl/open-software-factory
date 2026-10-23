// The session records in the data folder OSF_DATA (default .harness-acp): sessions/<session ID>.jsonl.
import { appendFileSync, mkdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { detectResources, envDetector } from "@opentelemetry/resources";
import type { SessionLine } from "../domain/session.ts";

const fileOf = (sessionId: string): string =>
  join(resolve(process.env.OSF_DATA ?? ".harness-acp"), "sessions", `${encodeURIComponent(sessionId)}.jsonl`);

export function append(sessionId: string, line: SessionLine): void {
  const file = fileOf(sessionId);
  mkdirSync(resolve(file, ".."), { recursive: true });
  appendFileSync(file, `${JSON.stringify(line)}\n`);
}

/** The text of a session's record; a session the adapter never ran is an error. */
export const readSession = (sessionId: string): string => readFileSync(fileOf(sessionId), "utf8");

/** The resource of the run from OTEL_RESOURCE_ATTRIBUTES and OTEL_SERVICE_NAME, as the OpenTelemetry SDK reads them. */
export function resourceOfEnvironment(): Record<string, string> {
  const { attributes } = detectResources({ detectors: [envDetector] });
  return Object.fromEntries(Object.entries(attributes).map(([key, value]) => [key, String(value)]));
}

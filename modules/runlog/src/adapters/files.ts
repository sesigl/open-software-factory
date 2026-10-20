// Files of the Git repository in the current folder, and the Agent Trace record runlog writes there.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { AgentTrace } from "../domain/agent-trace.ts";

/** The content of a file relative to the current folder, or undefined when there is none. */
export function readRepositoryFile(path: string): string | undefined {
  const file = resolve(path);
  return existsSync(file) ? readFileSync(file, "utf8") : undefined;
}

/** The file: URL of `file`, relative to the current folder. */
export const fileUrl = (file: string): string => pathToFileURL(resolve(file)).href;

/** Writes the record as JSON to `file`, relative to the current folder. */
export function writeAgentTrace(file: string, record: AgentTrace): void {
  writeFileSync(resolve(file), `${JSON.stringify(record, null, 2)}\n`);
}

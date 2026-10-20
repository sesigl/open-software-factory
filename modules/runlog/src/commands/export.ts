// runlog export <session file>: read a session, check its run against the run-record contract and write or send it.
// attach and watch export through the same steps.
import { join } from "node:path";
import { validate } from "@opensoftware/contracts";
import { fileUrl, readRepositoryFile, writeAgentTrace } from "../adapters/files.ts";
import { repository } from "../adapters/git.ts";
import { appendTo, resourceOf, send, spansOf } from "../adapters/otlp.ts";
import { readSession } from "../adapters/session-file.ts";
import { agentTraceOf } from "../domain/agent-trace.ts";
import { sessionOf } from "../domain/detect.ts";
import { type RunOptions, runOf, traceIdOf } from "../domain/run.ts";
import type { Session } from "../domain/session.ts";

export interface ExportOptions {
  includeContent: boolean;
  /** The folder runs.jsonl goes to. */
  output: string;
  /** Set when OTEL_EXPORTER_OTLP_ENDPOINT or OTEL_EXPORTER_OTLP_TRACES_ENDPOINT is. */
  endpoint?: string;
  version: string;
  /** The file to write the Agent Trace record to, relative to the current folder. */
  agentTrace?: string;
}

/** The session in the file; throws an Error that names the file when it is none. */
export function readSessionFile(file: string): Session {
  const session = sessionOf(readSession(file));
  if (!session) throw new Error(`${file} is not a Claude Code, Codex or OpenCode session`);
  return session;
}

/** Exports the run of the session and returns the line to print; throws an Error whose message names the problem. */
export async function exportRun(
  session: Session,
  options: ExportOptions,
  run: Omit<RunOptions, "includeContent" | "agentTraceUri"> = {},
): Promise<string> {
  const git = repository();
  const traceId = run.parent?.traceId ?? traceIdOf(session);
  const record = options.agentTrace ? agentTraceOf(session, readRepositoryFile, traceId, git.commit) : undefined;
  const agentTraceUri = options.agentTrace ? fileUrl(options.agentTrace) : undefined;
  const built = runOf(session, { ...run, includeContent: options.includeContent, agentTraceUri });
  const resource = resourceOf({
    ...built.resource,
    ...(git.email ? { "osf.requester.id": `git:${git.email}` } : {}),
    ...(git.commit ? { "osf.factory.version": git.commit } : {}),
  });
  const problems = validate("run-record", { resource: resource.attributes, span: built.root.attributes });
  if (problems.length) {
    const list = problems.map((problem) => `${problem.path} ${problem.message}`).join("; ");
    throw new Error(`the run does not match the run-record contract: ${list}`);
  }
  if (options.agentTrace && record) writeAgentTrace(options.agentTrace, record);
  const spans = spansOf(built, resource, options.version);
  if (options.endpoint) {
    const error = await send(spans);
    if (error) throw new Error(`the OTLP endpoint refused the run: ${error.message}`);
    return `exported the run of ${session.conversationId} to ${options.endpoint}`;
  }
  const target = join(options.output, "runs.jsonl");
  appendTo(target, spans);
  return `exported the run of ${session.conversationId} to ${target}`;
}

export const exportSession = (file: string, options: ExportOptions): Promise<string> =>
  exportRun(readSessionFile(file), options);

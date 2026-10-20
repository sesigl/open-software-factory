// runlog export <session file>: read a session, check its run against the run-record contract and write or send it.
import { join } from "node:path";
import { validate } from "@opensoftware/contracts";
import { repository } from "../adapters/git.ts";
import { appendTo, resourceOf, send, spansOf } from "../adapters/otlp.ts";
import { readSession } from "../adapters/session-file.ts";
import { sessionOf } from "../domain/detect.ts";
import { runOf } from "../domain/run.ts";

export interface ExportOptions {
  includeContent: boolean;
  /** The folder runs.jsonl goes to. */
  output: string;
  /** Set when OTEL_EXPORTER_OTLP_ENDPOINT or OTEL_EXPORTER_OTLP_TRACES_ENDPOINT is. */
  endpoint?: string;
  version: string;
}

/** Exports the session and returns the line to print; throws an Error whose message names the problem. */
export async function exportSession(file: string, options: ExportOptions): Promise<string> {
  const session = sessionOf(readSession(file));
  if (!session) throw new Error(`${file} is neither a Claude Code nor a Codex session`);
  const run = runOf(session, options.includeContent);
  const git = repository();
  const resource = resourceOf({
    ...run.resource,
    ...(git.email ? { "osf.requester.id": `git:${git.email}` } : {}),
    ...(git.commit ? { "osf.factory.version": git.commit } : {}),
  });
  const problems = validate("run-record", { resource: resource.attributes, span: run.root.attributes });
  if (problems.length) {
    const list = problems.map((problem) => `${problem.path} ${problem.message}`).join("; ");
    throw new Error(`the run does not match the run-record contract: ${list}`);
  }
  const spans = spansOf(run, resource, options.version);
  if (options.endpoint) {
    const error = await send(spans);
    if (error) throw new Error(`the OTLP endpoint refused the run: ${error.message}`);
    return `exported the run of ${session.conversationId} to ${options.endpoint}`;
  }
  const target = join(options.output, "runs.jsonl");
  appendTo(target, spans);
  return `exported the run of ${session.conversationId} to ${target}`;
}

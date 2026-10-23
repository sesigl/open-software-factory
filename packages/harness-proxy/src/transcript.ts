// exportTranscript: a recorded session as $OUTPUT/run-record.json and $OUTPUT/transcript.jsonl (ADR 0050).
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { runRecordOf } from "./domain/run-record.ts";
import type { SessionLine } from "./domain/session.ts";
import { readSession } from "./store.ts";

export interface TranscriptOptions {
  /** The session to export. */
  sessionId: string;
  /** The data folder that serveProxy recorded the session in. */
  data: string;
  /** The folder to write run-record.json and transcript.jsonl to. */
  output: string;
  /** The harness name of the run record, for example "claude-code". */
  harness: string;
}

/** Writes the session's run record and transcript and gives the absolute paths of both files. */
export function exportTranscript(options: TranscriptOptions): { recordFile: string; transcriptFile: string } {
  const text = readSession(options.data, options.sessionId);
  const folder = resolve(options.output);
  const recordFile = join(folder, "run-record.json");
  const transcriptFile = join(folder, "transcript.jsonl");
  const lines = text
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as SessionLine);
  const record = runRecordOf(lines, options.harness, pathToFileURL(transcriptFile).href);
  mkdirSync(folder, { recursive: true });
  writeFileSync(transcriptFile, text);
  writeFileSync(recordFile, `${JSON.stringify(record, null, 2)}\n`);
  return { recordFile, transcriptFile };
}

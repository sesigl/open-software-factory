// runlog watch <folder>...: export every session below the folders once it has ended, each one once (ADR 0024).
import { loadDone, pause, saveDone, sessionFiles } from "../adapters/folders.ts";
import { readSession } from "../adapters/session-file.ts";
import { sessionOf } from "../domain/detect.ts";
import { hasEnded } from "../domain/launch.ts";
import { type ExportOptions, exportRun } from "./export.ts";

export interface WatchOptions {
  /** Minutes a session's last event must lie before now. */
  idle: number;
  /** Passes to make; Infinity watches until the process is stopped. */
  passes: number;
  /** Seconds between two passes. */
  interval: number;
  /** The current time in milliseconds. */
  now: () => number;
}

/** One pass: exports the sessions that ended and were not exported at their current size. */
async function pass(folders: string[], done: Record<string, number>, watch: WatchOptions, options: ExportOptions) {
  for (const { file, size } of sessionFiles(folders)) {
    if (done[file] === size) continue;
    const session = sessionOf(readSession(file));
    if (session && !hasEnded(session, watch.now(), watch.idle)) continue;
    const line = session ? await exportRun(session, options).catch((error: Error) => error) : undefined;
    if (line instanceof Error) {
      process.stderr.write(`runlog: ${file}: ${line.message}\n`);
      continue;
    }
    if (line) process.stdout.write(`${line}\n`);
    done[file] = size;
    saveDone(done);
  }
}

export async function watchFolders(folders: string[], watch: WatchOptions, options: ExportOptions): Promise<void> {
  const done = loadDone();
  for (let count = 1; count <= watch.passes; count++) {
    await pass(folders, done, watch, options);
    if (count < watch.passes) await pause(watch.interval);
  }
}

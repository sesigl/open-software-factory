// The session files below the folders that watch looks at, and what watch remembers between its passes: the size of
// each file it is done with, in watch.json of its data folder OSF_DATA (default .runlog).
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

/** Every .jsonl and .json file below the folders, with its size, in a stable order. */
export function sessionFiles(folders: string[]): { file: string; size: number }[] {
  return folders
    .flatMap((folder) =>
      readdirSync(folder, { recursive: true, encoding: "utf8" })
        .filter((name) => /\.jsonl?$/.test(name))
        .map((name) => resolve(folder, name)),
    )
    .filter((file) => statSync(file).isFile())
    .sort()
    .map((file) => ({ file, size: statSync(file).size }));
}

const statePath = (): string => join(resolve(process.env.OSF_DATA ?? ".runlog"), "watch.json");

/** The size of each file watch is done with. */
export function loadDone(): Record<string, number> {
  const file = statePath();
  return statSync(file, { throwIfNoEntry: false }) ? JSON.parse(readFileSync(file, "utf8")) : {};
}

export function saveDone(done: Record<string, number>): void {
  mkdirSync(resolve(process.env.OSF_DATA ?? ".runlog"), { recursive: true });
  writeFileSync(statePath(), `${JSON.stringify(done, null, 2)}\n`);
}

export const pause = (seconds: number): Promise<void> => new Promise((done) => setTimeout(done, seconds * 1000));

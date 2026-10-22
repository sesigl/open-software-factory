// Files: score files, run records, problems.json and the JSON and text observer writes.
import { readFileSync } from "node:fs";
import { readInputs, UsageError, writeText } from "@opensoftware/cli";
import { runSpans, type Score, validate } from "@opensoftware/contracts";
import type { Problem, RunInfo } from "../domain/problems.ts";
import { runInfoOf } from "../domain/problems.ts";

/** Each JSON line of the .jsonl files named and below the folders named, with its file and line number. */
function* jsonLines(paths: string[]): Generator<{ where: string; value: unknown }> {
  for (const { file, text } of readInputs(paths, /\.jsonl$/))
    for (const [index, line] of text.split("\n").entries()) {
      if (!line.trim()) continue;
      const where = `${file}:${index + 1}`;
      try {
        yield { where, value: JSON.parse(line) };
      } catch {
        throw new UsageError(`${where}: not JSON`);
      }
    }
}

/** The score records, each checked against the `score` contract. */
export function readScores(paths: string[]): Score[] {
  if (!paths.length) throw new UsageError("name at least one scores file or folder");
  return [...jsonLines(paths)].map(({ where, value }) => {
    const problem = validate("score", value)[0];
    if (problem) throw new UsageError(`${where}: not a score: ${problem.path} ${problem.message}`);
    return value as Score;
  });
}

/** What the run records below the paths tell about each run. */
export function readRuns(paths: string[]): Map<string, RunInfo> {
  return runInfoOf([...jsonLines(paths)].flatMap(({ value }) => runSpans(value) ?? []));
}

export const readProblems = (path: string): Problem[] =>
  (JSON.parse(readFileSync(path, "utf8")) as { problems?: Problem[] }).problems ?? [];

export function writeJson(path: string, value: unknown): string {
  writeText(path, `${JSON.stringify(value, null, 2)}\n`);
  return path;
}

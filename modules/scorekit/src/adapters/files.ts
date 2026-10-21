// Files: runs files and folders, scorer files and the pack, score files.
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { type Input, readInputs, UsageError } from "@opensoftware/cli";
import { type Score, validate } from "@opensoftware/contracts";
import { jsonLines } from "../domain/lines.ts";
import { parseScorer, type Scorer } from "../domain/scorer.ts";

/** The scorers the package ships, in scorers/ next to dist/. */
const PACK = fileURLToPath(new URL("../../scorers/", import.meta.url));

/** Each runs file named, and every .jsonl file below each folder named, sorted by path. */
export function readRunFiles(paths: string[]): Input[] {
  if (!paths.length) throw new UsageError("name at least one runs file or folder");
  return readInputs(paths, /\.jsonl$/);
}

export function packNames(): string[] {
  return readdirSync(PACK)
    .filter((file) => file.endsWith(".md"))
    .map((file) => file.slice(0, -3))
    .sort();
}

/** A scorer by pack name, or by path when the value names a Markdown file or a folder. */
export function readScorer(value: string | undefined): Scorer {
  if (!value) throw new UsageError("--scorer is required: a pack name or a scorer file");
  const isPath = value.endsWith(".md") || value.includes("/");
  const file = isPath ? value : join(PACK, `${value}.md`);
  if (!existsSync(file))
    throw new UsageError(
      isPath ? `${value}: no such scorer file` : `no scorer "${value}" in the pack: ${packNames().join(", ")}`,
    );
  return parseScorer(isPath ? value : `${value}.md`, basename(file, ".md"), readFileSync(file, "utf8"));
}

/** The score records of score files, each checked against the `score` contract. A missing file has none. */
export function readScores(paths: string[], { missingOk = false } = {}): Score[] {
  return paths.flatMap((path) => {
    if (missingOk && !existsSync(path)) return [];
    return jsonLines(path, readFileSync(path, "utf8")).map(({ line, value }) => {
      const [problem] = validate("score", value);
      if (problem) throw new UsageError(`${path}:${line}: not a score: ${problem.path} ${problem.message}`);
      return value as Score;
    });
  });
}

export function appendScore(path: string, score: Score): void {
  const problems = validate("score", score);
  if (problems.length) throw new Error(`a score breaks the contract: ${problems[0]?.path} ${problems[0]?.message}`);
  mkdirSync(dirname(path), { recursive: true });
  appendFileSync(path, `${JSON.stringify(score)}\n`);
}

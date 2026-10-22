// observer analyze: scores (and run records) in, problems.json (and a Markdown table) out.
import { writeText } from "@opensoftware/cli";
import { readRuns, readScores, writeJson } from "../adapters/files.ts";
import { problemLine, problemsTable } from "../domain/present.ts";
import { problemsOf } from "../domain/problems.ts";

export function analyze(
  paths: string[],
  options: { runs: string[]; minFailures: number; out: string; markdown: string | undefined },
): string[] {
  const problems = problemsOf(readScores(paths), readRuns(options.runs), options.minFailures);
  writeJson(options.out, { minFailures: options.minFailures, problems });
  if (options.markdown) writeText(options.markdown, problemsTable(problems));
  const lines = problems.length
    ? problems.map(problemLine)
    : [`no problems: no scorer failed ${options.minFailures} runs or more`];
  return [...lines, `wrote ${options.out}`];
}

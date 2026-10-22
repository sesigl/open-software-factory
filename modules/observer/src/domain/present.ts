// The text people read: the lines of analyze and the Markdown table of problems.
import type { Problem } from "./problems.ts";

export const percent = (share: number): string => `${(share * 100).toFixed(1)}%`;

export const problemLine = (problem: Problem): string =>
  `${problem.id}: failed ${problem.failures} of ${problem.scored} runs (${percent(problem.failureRate)})`;

export function problemsTable(problems: Problem[]): string {
  const rows = problems.map(
    (problem) =>
      `| ${problem.id} | ${problem.failures} | ${problem.scored} | ${percent(problem.failureRate)} | ${cell(problem.reasons[0]?.reason ?? "")} |`,
  );
  return [
    "# Problems",
    "",
    "| Problem | Failures | Scored runs | Failure rate | Top reason |",
    "| --- | --- | --- | --- | --- |",
    ...rows,
    "",
  ].join("\n");
}

/** A table cell keeps one line and no column breaks. */
const cell = (text: string): string => text.replaceAll("|", "\\|").replace(/\s+/g, " ");

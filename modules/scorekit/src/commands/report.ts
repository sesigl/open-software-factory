// scorekit report: sum up score files as JSON and, with --markdown, as Markdown.
import { readScores, writeText } from "../adapters/files.ts";
import { markdown, report as sum } from "../domain/report.ts";

export function report(paths: string[], options: { out: string; markdown?: string }): string[] {
  const result = sum(readScores(paths));
  writeText(options.out, `${JSON.stringify(result, null, 2)}\n`);
  if (options.markdown) writeText(options.markdown, markdown(result));
  return result.scorers.map(
    (one) => `${one.name}: ${one.scored} runs, pass rate ${(one.passRate * 100).toFixed(1)}%, cost ${one.costUsd} USD`,
  );
}

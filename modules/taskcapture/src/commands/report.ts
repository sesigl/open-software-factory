// taskcapture report: Harbor trial results → report.json, and Markdown and a Vega-Lite chart on request.
import { basename, dirname, relative } from "node:path";
import { findFiles, readText, writeFile } from "../adapters/files.ts";
import { report as build, type Trial, trialOf } from "../domain/cells.ts";
import { usage } from "../domain/errors.ts";
import { chart, markdown, summaryLines } from "../domain/present.ts";

export function report(
  paths: string[],
  options: { out: string; markdown: string | undefined; chart: string | undefined },
): string[] {
  const trials: Trial[] = [];
  for (const file of findFiles(paths, "result.json")) {
    const job = dirname(dirname(file));
    const trial = trialOf(JSON.parse(readText(file)), basename(job), relative(process.cwd(), job) || ".");
    if (trial) trials.push(trial);
  }
  usage(trials.length, `no Harbor trial result (result.json with trial_name) in ${paths.join(", ")}`);
  const result = build(trials);
  const written = [writeFile(options.out, `${JSON.stringify(result, null, 2)}\n`)];
  if (options.markdown) written.push(writeFile(options.markdown, markdown(result)));
  if (options.chart) written.push(writeFile(options.chart, `${JSON.stringify(chart(result), null, 2)}\n`));
  return [...summaryLines(result), ...written.map((file) => `wrote ${file}`)];
}

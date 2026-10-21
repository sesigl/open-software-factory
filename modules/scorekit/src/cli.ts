#!/usr/bin/env node
// scorekit <command>: the entry layer only parses arguments and calls the commands.
import { join } from "node:path";
import { parseArgs } from "node:util";
import { calibrate } from "./commands/calibrate.ts";
import { push } from "./commands/push.ts";
import { report } from "./commands/report.ts";
import { score } from "./commands/score.ts";
import { scorers } from "./commands/scorers.ts";
import { UsageError } from "./domain/errors.ts";

const HELP = `Usage: scorekit <command> [options]

Commands:
  score --scorer <name|file> [--seed <n>] [--sample <0..1>] [--out <file>] <runs file or folder>...  Ask the scorer's judge about each sampled run without a score of the scorer and append the scores to --out ($OUTPUT/scores.jsonl).
  calibrate --scorer <name|file> --labels <file> [--min-agreement <0..1>] [--out <file>] <runs file or folder>...  Judge every labeled run and write the agreement with the labels to --out ($OUTPUT/calibration.json). Exits 1 below --min-agreement.
  report [--out <file>] [--markdown <file>] <scores file>...  Write each scorer's pass rate, cost, pass rate per day and scored runs to --out ($OUTPUT/report.json), and as Markdown to --markdown.
  push <scores file>...  Send the scores to Langfuse's score API.
  scorers  List the scorers of the pack with their sampling rate and description.
`;

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    help: { type: "boolean" },
    scorer: { type: "string" },
    seed: { type: "string" },
    sample: { type: "string" },
    out: { type: "string" },
    labels: { type: "string" },
    "min-agreement": { type: "string" },
    markdown: { type: "string" },
  },
});
const [command, ...paths] = positionals;
const env = process.env;
const output = (file: string) => values.out ?? join(env.OUTPUT ?? ".", file);

type Result = { lines: string[]; errors?: string[]; failed?: boolean };
const commands: Record<string, () => Promise<Result> | Result> = {
  score: () =>
    score(
      paths,
      {
        scorer: values.scorer,
        seed: values.seed ?? "0",
        sample: values.sample,
        out: output("scores.jsonl"),
        now: env.OSF_NOW ?? new Date().toISOString(),
      },
      env,
    ),
  calibrate: () =>
    calibrate(
      paths,
      {
        scorer: values.scorer,
        labels: values.labels,
        minAgreement: values["min-agreement"],
        out: output("calibration.json"),
      },
      env,
    ),
  report: () => ({ lines: report(paths, { out: output("report.json"), markdown: values.markdown }) }),
  push: () => push(paths, env),
  scorers: () => ({ lines: scorers() }),
};
const chosen = command && !values.help ? commands[command] : undefined;

if (chosen) {
  try {
    const { lines, errors = [], failed } = await chosen();
    for (const error of errors) process.stderr.write(`scorekit: ${error}\n`);
    process.stdout.write(`${lines.join("\n")}\n`);
    if (failed ?? errors.length > 0) process.exitCode = 1;
  } catch (error) {
    process.stderr.write(`scorekit: ${(error as Error).message}\n`);
    process.exitCode = error instanceof UsageError ? 2 : 1;
  }
} else {
  (values.help ? process.stdout : process.stderr).write(HELP);
  process.exitCode = values.help ? 0 : 2;
}

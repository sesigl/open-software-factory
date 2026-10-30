#!/usr/bin/env node
// scorekit <command>: the entry layer only parses arguments and calls the commands.
import { parseArgs } from "node:util";
import { type Command, outputPath, runProgram } from "@opensoftware/cli";
import { calibrate } from "./commands/calibrate.ts";
import { exportEvaluators } from "./commands/export.ts";
import { push } from "./commands/push.ts";
import { report } from "./commands/report.ts";
import { score } from "./commands/score.ts";
import { scorers } from "./commands/scorers.ts";

const HELP = `Usage: scorekit <command> [options]

Commands:
  score --scorer <name|file> [--seed <n>] [--sample <0..1>] [--model <name>] [--out <file>] <runs file or folder>...  Ask the scorer's judge about each sampled run without a score of the scorer and append the scores to --out ($OUTPUT/scores.jsonl).
  calibrate --scorer <name|file> --labels <file> [--min-agreement <0..1>] [--out <file>] <runs file or folder>...  Judge every labeled run and write the agreement with the labels to --out ($OUTPUT/calibration.json). Exits 1 below --min-agreement.
  report [--out <file>] [--markdown <file>] <scores file>...  Write each scorer's pass rate, cost, pass rate per day and scored runs to --out ($OUTPUT/report.json), and as Markdown to --markdown.
  push <scores file>...  Send the scores to Langfuse's score API.
  export [--scorer <name|file>]... [--provider <name> --model <name>] [--out <file>]  Write the scorers (default: the pack) as Langfuse LLM-as-a-judge evaluators with their evaluation rules to --out ($OUTPUT/evaluators.json).
  export --push [--enable] [--scorer <name|file>]... [--provider <name> --model <name>]  Create or update the evaluators in Langfuse; a new evaluator gets a rule, disabled unless --enable.
  scorers  List the scorers of the pack with their sampling rate and description.
`;

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    help: { type: "boolean" },
    scorer: { type: "string", multiple: true },
    seed: { type: "string" },
    sample: { type: "string" },
    out: { type: "string" },
    labels: { type: "string" },
    "min-agreement": { type: "string" },
    markdown: { type: "string" },
    provider: { type: "string" },
    model: { type: "string" },
    push: { type: "boolean" },
    enable: { type: "boolean" },
  },
});
const [command, ...paths] = positionals;
const env = process.env;
/** score and calibrate take one scorer: the last one named. */
const scorer = values.scorer?.at(-1);
const output = (file: string) => outputPath(file, values.out);

const commands: Record<string, Command> = {
  score: () =>
    score(
      paths,
      {
        scorer,
        seed: values.seed ?? "0",
        sample: values.sample,
        model: values.model,
        out: output("scores.jsonl"),
        now: env.OSF_NOW ?? new Date().toISOString(),
      },
      env,
    ),
  calibrate: () =>
    calibrate(
      paths,
      {
        scorer,
        labels: values.labels,
        minAgreement: values["min-agreement"],
        out: output("calibration.json"),
      },
      env,
    ),
  report: () => ({ lines: report(paths, { out: output("report.json"), markdown: values.markdown }) }),
  push: () => push(paths, env),
  export: () =>
    exportEvaluators(
      {
        scorers: values.scorer ?? [],
        provider: values.provider,
        model: values.model,
        push: values.push ?? false,
        enable: values.enable ?? false,
        out: output("evaluators.json"),
      },
      env,
    ),
  scorers: () => ({ lines: scorers() }),
};
const chosen = command ? commands[command] : undefined;
process.exitCode = await runProgram({ name: "scorekit", usage: HELP, command: chosen, help: values.help });

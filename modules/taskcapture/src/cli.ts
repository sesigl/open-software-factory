#!/usr/bin/env node
// taskcapture <command>: the entry layer only parses arguments and calls the commands.
import { join } from "node:path";
import { parseArgs } from "node:util";
import { capture } from "./commands/capture.ts";
import { report } from "./commands/report.ts";
import { route } from "./commands/route.ts";
import { UsageError, usage } from "./domain/errors.ts";
import { pullRefOf } from "./domain/pull.ts";
import { TEST_FILES } from "./domain/task.ts";

const HELP = `Usage: taskcapture <command> [options]

Commands:
  capture [--suite <folder>] [--git <folder>] [--forge github|forgejo] [--tests <regex>] [--image <image>] [--setup <command>] [--test-command <command>] <pull request URL>
         Write the merged pull request as a Harbor task into --suite ($OUTPUT/suite), with the suite's prompt-injection task.
  report [--out <file>] [--markdown <file>] [--chart <file>] <job folder or result.json>...
         Correctness and average cost per configuration and model from Harbor's trial results, to --out ($OUTPUT/report.json).
  route --tag <tag> --alias <model name> [--model <model> | --min-correctness <0 to 1>] [--config <file>] [--out <file>] <report.json>
         Write a LiteLLM config that sends the alias with the tag to the chosen model, to --out ($OUTPUT/litellm-config.yaml).
`;

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    help: { type: "boolean" },
    suite: { type: "string" },
    git: { type: "string" },
    forge: { type: "string" },
    tests: { type: "string", default: TEST_FILES },
    image: { type: "string" },
    setup: { type: "string" },
    "test-command": { type: "string" },
    out: { type: "string" },
    markdown: { type: "string" },
    chart: { type: "string" },
    tag: { type: "string" },
    alias: { type: "string" },
    model: { type: "string" },
    "min-correctness": { type: "string" },
    config: { type: "string" },
  },
});
const [command, ...paths] = positionals;
const output = (file: string) => values.out ?? join(process.env.OUTPUT ?? ".", file);

function regex(source: string): RegExp {
  try {
    return new RegExp(source);
  } catch {
    throw new UsageError(`--tests takes a regular expression, like ^checks/`);
  }
}

async function main(): Promise<string[]> {
  if (command === "capture") {
    usage(paths.length === 1, "capture takes one pull request URL, like https://github.com/acme/web/pull/7");
    const ref = pullRefOf(paths[0] as string, values.forge, process.env.TASKCAPTURE_FORGE_URL || undefined);
    const line = await capture(ref, {
      suite: values.suite ?? join(process.env.OUTPUT ?? ".", "suite"),
      git: values.git,
      token: process.env.TASKCAPTURE_FORGE_TOKEN || undefined,
      tests: regex(values.tests),
      image: values.image,
      setup: values.setup,
      testCommand: values["test-command"],
    });
    return [line];
  }
  if (command === "report") {
    usage(paths.length > 0, "report takes Harbor job folders or result.json files");
    return report(paths, { out: output("report.json"), markdown: values.markdown, chart: values.chart });
  }
  const { tag, alias } = values;
  usage(tag && alias, "route takes --tag and --alias, like --tag front-end --alias coder");
  usage(paths.length === 1, "route takes one report.json");
  const min = values["min-correctness"];
  usage(
    min === undefined || (/^(0(\.\d+)?|1(\.0+)?)$/.test(min)),
    "--min-correctness takes a share from 0 to 1, like 0.9",
  );
  return route(paths[0] as string, {
    tag,
    alias,
    model: values.model,
    minCorrectness: min === undefined ? undefined : Number(min),
    config: values.config,
    out: output("litellm-config.yaml"),
  });
}

if (["capture", "report", "route"].includes(command as string) && !values.help) {
  try {
    process.stdout.write(`${(await main()).join("\n")}\n`);
  } catch (error) {
    process.stderr.write(`taskcapture: ${(error as Error).message}\n`);
    process.exitCode = error instanceof UsageError ? 2 : 1;
  }
} else {
  (values.help ? process.stdout : process.stderr).write(HELP);
  process.exitCode = values.help ? 0 : 2;
}

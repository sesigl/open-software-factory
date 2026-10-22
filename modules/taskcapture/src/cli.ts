#!/usr/bin/env node
// taskcapture <command>: the entry layer only parses arguments and calls the commands.
import { join } from "node:path";
import { parseArgs } from "node:util";
import { type Command, check, outputPath, runProgram, UsageError } from "@opensoftware/cli";
import { capture } from "./commands/capture.ts";
import { report } from "./commands/report.ts";
import { route } from "./commands/route.ts";
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
const output = (file: string) => outputPath(file, values.out);

function regex(source: string): RegExp {
  try {
    return new RegExp(source);
  } catch {
    throw new UsageError(`--tests takes a regular expression, like ^checks/`);
  }
}

const commands: Record<string, Command> = {
  capture: async () => {
    check(paths.length === 1, "capture takes one pull request URL, like https://github.com/acme/web/pull/7");
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
    return { lines: [line] };
  },
  report: () => {
    check(paths.length > 0, "report takes Harbor job folders or result.json files");
    return { lines: report(paths, { out: output("report.json"), markdown: values.markdown, chart: values.chart }) };
  },
  route: () => {
    const { tag, alias } = values;
    check(tag && alias, "route takes --tag and --alias, like --tag front-end --alias coder");
    check(paths.length === 1, "route takes one report.json");
    const min = values["min-correctness"];
    check(
      min === undefined || /^(0(\.\d+)?|1(\.0+)?)$/.test(min),
      "--min-correctness takes a share from 0 to 1, like 0.9",
    );
    return {
      lines: route(paths[0] as string, {
        tag,
        alias,
        model: values.model,
        minCorrectness: min === undefined ? undefined : Number(min),
        config: values.config,
        out: output("litellm-config.yaml"),
      }),
    };
  },
};
const chosen = command ? commands[command] : undefined;
process.exitCode = await runProgram({ name: "taskcapture", usage: HELP, command: chosen, help: values.help });

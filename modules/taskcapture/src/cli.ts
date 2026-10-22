#!/usr/bin/env node
// taskcapture <command>: the entry layer only parses arguments and calls the commands.
import { join } from "node:path";
import { parseArgs } from "node:util";
import { type Command, check, outputPath, runProgram, UsageError } from "@opensoftware/cli";
import { capture, readRun } from "./commands/capture.ts";
import { report } from "./commands/report.ts";
import { route } from "./commands/route.ts";
import { run } from "./commands/run.ts";
import { pullRefOf } from "./domain/pull.ts";
import { configurationOf, DEFAULT_CONFIGURATION, pullOfRun } from "./domain/run.ts";
import { TEST_FILES } from "./domain/task.ts";

const HELP = `Usage: taskcapture <command> [options]

Commands:
  capture [--suite <folder>] [--git <folder>] [--forge github|forgejo] [--tests <regex>] [--image <image>] [--setup <command>] [--test-command <command>] [--run <run record>] <pull request URL>
         Write the merged pull request as a Harbor task into --suite ($OUTPUT/suite), with the suite's prompt-injection task.
         With --run, the pull request of the run record; the task names the run.
  run --agent <agent> [--model <model>]... [--configuration <name>[=<Harbor config file>]]... [--suite <folder>] [--jobs <folder>] [--allow-host <host>]... [--out <file>] [--markdown <file>] [--chart <file>]
         Run the suite with harbor, one job per configuration into --jobs ($OUTPUT/jobs), then report like "report".
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
    model: { type: "string", multiple: true },
    run: { type: "string" },
    agent: { type: "string" },
    configuration: { type: "string", multiple: true },
    jobs: { type: "string" },
    "allow-host": { type: "string", multiple: true },
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
    const usage = "capture takes one pull request URL, like https://github.com/acme/web/pull/7";
    const source = values.run === undefined ? undefined : readRun(values.run);
    check(paths.length === 1 || (source && paths.length === 0), usage);
    const url = source ? pullOfRun(source, paths[0]) : (paths[0] as string);
    const ref = pullRefOf(url, values.forge, process.env.TASKCAPTURE_FORGE_URL || undefined);
    const line = await capture(ref, {
      suite: values.suite ?? join(process.env.OUTPUT ?? ".", "suite"),
      git: values.git,
      token: process.env.TASKCAPTURE_FORGE_TOKEN || undefined,
      tests: regex(values.tests),
      image: values.image,
      setup: values.setup,
      testCommand: values["test-command"],
      run: source,
    });
    return { lines: [line] };
  },
  run: async () => {
    check(values.agent, "run takes --agent, like --agent claude-code or --agent oracle");
    const configurations = values.configuration?.map(configurationOf) ?? [DEFAULT_CONFIGURATION];
    const outputs = process.env.OUTPUT ?? ".";
    return {
      lines: await run({
        suite: values.suite ?? join(outputs, "suite"),
        jobs: values.jobs ?? join(outputs, "jobs"),
        agent: values.agent,
        models: values.model ?? [],
        allowHosts: values["allow-host"] ?? [],
        configurations,
        harbor: process.env.TASKCAPTURE_HARBOR || "harbor",
        report: { out: output("report.json"), markdown: values.markdown, chart: values.chart },
      }),
    };
  },
  report: () => {
    check(paths.length > 0, "report takes Harbor job folders or result.json files");
    return { lines: report(paths, { out: output("report.json"), markdown: values.markdown, chart: values.chart }) };
  },
  route: () => {
    const { tag, alias } = values;
    check(tag && alias, "route takes --tag and --alias, like --tag front-end --alias coder");
    check(paths.length === 1, "route takes one report.json");
    check((values.model?.length ?? 0) <= 1, "route takes one --model");
    const min = values["min-correctness"];
    check(
      min === undefined || /^(0(\.\d+)?|1(\.0+)?)$/.test(min),
      "--min-correctness takes a share from 0 to 1, like 0.9",
    );
    return {
      lines: route(paths[0] as string, {
        tag,
        alias,
        model: values.model?.[0],
        minCorrectness: min === undefined ? undefined : Number(min),
        config: values.config,
        out: output("litellm-config.yaml"),
      }),
    };
  },
};
const chosen = command ? commands[command] : undefined;
process.exitCode = await runProgram({ name: "taskcapture", usage: HELP, command: chosen, help: values.help });

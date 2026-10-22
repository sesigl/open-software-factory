#!/usr/bin/env node
// observer <command>: the entry layer only parses arguments and calls the commands.
import { parseArgs } from "node:util";
import { type Command, outputPath, check as require, runProgram, UsageError } from "@opensoftware/cli";
import { readProblems } from "./adapters/files.ts";
import { analyze } from "./commands/analyze.ts";
import { check } from "./commands/check.ts";
import { pickProblem, propose } from "./commands/propose.ts";
import { pullRequestOf } from "./domain/forge-url.ts";

const HELP = `Usage: observer <command> [options]

Commands:
  analyze [--runs <file or folder>]... [--min-failures <n>] [--out <file>] [--markdown <file>] <scores file or folder>...
         Group the failed scores by scorer into problems, to --out ($OUTPUT/problems.json).
  propose --repo <repository URL> [--problem <id>] [--file <path>]... [--model <model>] [--out <file>] <problems.json>
         Ask the model for a fix of the problem in the files, push it to a branch of its own and open a pull request.
  check --problem <id> (--merged-at <time> | --pull-request <URL>) [--min-runs <n>] [--runs <file or folder>]... [--comment] [--out <file>] <scores file or folder>...
         Compare the problem's failure rate before and after the merge, to --out ($OUTPUT/check.json).
`;

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    help: { type: "boolean" },
    runs: { type: "string", multiple: true, default: [] },
    "min-failures": { type: "string", default: "3" },
    out: { type: "string" },
    markdown: { type: "string" },
    repo: { type: "string" },
    problem: { type: "string" },
    file: { type: "string", multiple: true, default: ["AGENTS.md"] },
    model: { type: "string", default: "observer" },
    "merged-at": { type: "string" },
    "pull-request": { type: "string" },
    "min-runs": { type: "string", default: "20" },
    comment: { type: "boolean", default: false },
  },
});
const [command, ...paths] = positionals;
const { env } = process;

function count(option: "min-failures" | "min-runs"): number {
  const value = values[option];
  require(/^[1-9]\d*$/.test(value), `--${option} takes a whole number from 1, like 3`);
  return Number(value);
}

const commands: Record<string, Command> = {
  analyze: () => ({
    lines: analyze(paths, {
      runs: values.runs,
      minFailures: count("min-failures"),
      out: outputPath("problems.json", values.out),
      markdown: values.markdown,
    }),
  }),
  propose: async () => {
    require(values.repo, "propose takes --repo, like --repo https://github.com/acme/factory");
    require(paths.length === 1, "propose takes one problems.json");
    const url = env.OBSERVER_INFERENCE_URL;
    if (!url) throw new UsageError("set OBSERVER_INFERENCE_URL to an OpenAI-compatible gateway");
    const file = paths[0] as string;
    const problem = pickProblem(readProblems(file), values.problem, file);
    return {
      lines: await propose(problem, {
        repo: values.repo,
        files: values.file,
        model: values.model,
        gateway: { url, key: env.OBSERVER_INFERENCE_KEY || undefined },
        forge: { api: env.OBSERVER_FORGE_URL || undefined, token: env.OBSERVER_FORGE_TOKEN || undefined },
        out: outputPath("proposal.json", values.out),
      }),
    };
  },
  check: async () => {
    const { problem, "merged-at": merged, "pull-request": pull } = values;
    require(problem, "check takes --problem, like --problem research-skill-used");
    require((merged === undefined) !== (pull === undefined), "check takes either --merged-at or --pull-request");
    require(merged === undefined ||
      !Number.isNaN(Date.parse(merged)), "--merged-at takes a time like 2026-01-10T00:00:00Z");
    require(!values.comment || pull, "--comment needs --pull-request");
    return {
      lines: await check(paths, {
        problem,
        mergedAt: merged,
        pullRequest: pull === undefined ? undefined : pullRequestOf(pull, env.OBSERVER_FORGE_URL || undefined),
        token: env.OBSERVER_FORGE_TOKEN || undefined,
        minRuns: count("min-runs"),
        runs: values.runs,
        comment: values.comment,
        out: outputPath("check.json", values.out),
      }),
    };
  },
};
const chosen = command ? commands[command] : undefined;
process.exitCode = await runProgram({ name: "observer", usage: HELP, command: chosen, help: values.help });

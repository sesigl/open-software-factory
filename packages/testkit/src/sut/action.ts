// The module's composite GitHub Action (action.yml), run like a runner runs it: each `run` step in bash, with the
// module's built bin as the input `command`.
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { parse } from "yaml";
import { baseEnv, type CliResult, run } from "../support/process.ts";
import type { Launch } from "./launch.ts";
import type { Folders } from "./sut.ts";

export interface ActionOptions {
  /** The event payload in `GITHUB_EVENT_PATH`. Default `{}`. */
  event?: unknown;
  /** `GITHUB_EVENT_NAME`. Default `pull_request` when the event has a pull request, else `push`. */
  eventName?: string;
  /** `GITHUB_REPOSITORY`. Default `acme/web`. */
  repository?: string;
  /** `GITHUB_SHA`. Default the HEAD of the Git repository in $INPUT. */
  sha?: string;
  /** Variables the module's README documents, as for `cli`. */
  env?: Record<string, string>;
}

export interface ActionResult extends CliResult {
  /** What the steps wrote to `GITHUB_OUTPUT`, by name. */
  outputs: Record<string, string>;
  /** The `uses` of every step the testkit did not run. */
  skipped: string[];
  /** What the steps wrote to the job summary in `GITHUB_STEP_SUMMARY`. */
  summary: string;
}

export type Action = (inputs?: Record<string, string>, options?: ActionOptions) => Promise<ActionResult>;

interface Step {
  id?: string;
  run?: string;
  uses?: string;
  shell?: string;
  if?: string;
  env?: Record<string, string>;
}

interface Manifest {
  inputs?: Record<string, { default?: string }>;
  runs: { using: "composite"; steps: Step[] };
}

/** The token a step gets for `${{ github.token }}`. */
const TOKEN = "testkit-github-token";

export function makeAction(moduleRoot: string, dirs: Folders, launch: Launch): Action {
  return async (given = {}, options = {}) => {
    const manifest = parse(readFileSync(join(moduleRoot, "action.yml"), "utf8")) as Manifest;
    const declared: Record<string, { default?: string }> = { ...manifest.inputs };
    for (const name of Object.keys(given)) {
      if (!(name in declared)) throw new Error(`sut.action: action.yml has no input "${name}"`);
    }
    const module = launch([], options.env);
    const values: Record<string, string> = {};
    const expand = (text: string): string =>
      text.replace(/\$\{\{\s*([^}]*?)\s*\}\}/g, (expression, name: string) => {
        if (name === "github.action_path") return moduleRoot;
        if (name === "github.token") return TOKEN;
        const input = /^inputs\.([\w-]+)$/.exec(name)?.[1];
        if (input !== undefined && input in declared) return values[input] as string;
        throw new Error(`sut.action supports only inputs.<name>, github.action_path and github.token: ${expression}`);
      });
    for (const [name, input] of Object.entries(declared)) values[name] = given[name] ?? expand(input.default ?? "");
    if ("command" in declared && given.command === undefined) {
      values.command = [module.command, ...module.argv].map(quote).join(" ");
    }

    const runner = mkdtempSync(join(dirname(dirs.input), "runner-"));
    const temp = join(runner, "temp");
    mkdirSync(temp);
    const event = options.event ?? {};
    writeFileSync(join(runner, "event.json"), JSON.stringify(event));
    const summary = join(runner, "summary.md");
    writeFileSync(summary, "");
    const head = await run("git", ["rev-parse", "--verify", "--quiet", "HEAD"], dirs.input, baseEnv(dirs.input));
    const runnerEnv = {
      GITHUB_ACTIONS: "true",
      GITHUB_ACTION_PATH: moduleRoot,
      GITHUB_WORKSPACE: dirs.input,
      GITHUB_EVENT_PATH: join(runner, "event.json"),
      GITHUB_EVENT_NAME:
        options.eventName ?? ((event as { pull_request?: unknown }).pull_request ? "pull_request" : "push"),
      GITHUB_REPOSITORY: options.repository ?? "acme/web",
      GITHUB_SERVER_URL: "https://github.com",
      GITHUB_RUN_ID: "1",
      GITHUB_SHA: options.sha ?? (head.stdout.trim() || "0".repeat(40)),
      RUNNER_TEMP: temp,
      GITHUB_STEP_SUMMARY: summary,
    };

    const result: ActionResult = { exitCode: 0, stdout: "", stderr: "", outputs: {}, skipped: [], summary: "" };
    for (const [index, step] of manifest.runs.steps.entries()) {
      if (step.uses) {
        result.skipped.push(step.uses);
        continue;
      }
      if (step.run === undefined || step.shell !== "bash" || step.if !== undefined) {
        throw new Error(`sut.action runs only "run" steps with "shell: bash" and without "if:", not step ${index + 1}`);
      }
      const script = join(runner, `step-${index + 1}.sh`);
      const output = join(runner, `output-${index + 1}`);
      writeFileSync(script, expand(step.run));
      writeFileSync(output, "");
      const stepEnv = Object.fromEntries(Object.entries(step.env ?? {}).map(([key, value]) => [key, expand(value)]));
      const ran = await run("bash", ["--noprofile", "--norc", "-eo", "pipefail", script], dirs.input, {
        ...module.env,
        ...runnerEnv,
        GITHUB_OUTPUT: output,
        ...stepEnv,
      });
      result.stdout += ran.stdout;
      result.stderr += ran.stderr;
      Object.assign(result.outputs, outputsOf(readFileSync(output, "utf8")));
      if (ran.exitCode !== 0) {
        result.exitCode = ran.exitCode;
        break;
      }
    }
    result.summary = readFileSync(summary, "utf8");
    return result;
  };
}

/** The `name=value` lines a step wrote to `GITHUB_OUTPUT`. */
function outputsOf(text: string): Record<string, string> {
  const outputs: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const at = line.indexOf("=");
    if (at > 0) outputs[line.slice(0, at)] = line.slice(at + 1);
  }
  return outputs;
}

function quote(word: string): string {
  return `'${word.replaceAll("'", "'\\''")}'`;
}

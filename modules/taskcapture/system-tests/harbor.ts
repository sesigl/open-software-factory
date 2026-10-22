// A scripted stand-in for the harbor CLI, which "taskcapture run" starts through TASKCAPTURE_HARBOR. It records its
// arguments in $INPUT/harbor-calls.jsonl and writes one trial result per task and model, the way `harbor run` writes
// them: <jobs dir>/<job name>/<task>__<trial>/result.json. Its script says each trial's reward and cost.
import type { CliResult } from "@opensoftware/testkit";

export interface ScriptedTrial {
  /** The trial's model, or the agent's name when the run names no model. */
  model: string;
  task: string;
  reward: number;
  costUsd?: number;
}

export interface HarborScript {
  /** Trials the script does not name score 1 at 1.00 USD. */
  trials?: ScriptedTrial[];
  /** Harbor exits with this code before it writes anything. */
  exitCode?: number;
}

const STAND_IN = `
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
const args = process.argv.slice(2);
appendFileSync("harbor-calls.jsonl", JSON.stringify(args) + "\\n");
const script = JSON.parse(readFileSync("harbor-script.json", "utf8"));
if (script.exitCode) process.exit(script.exitCode);
const values = (flag) => args.flatMap((arg, i) => (arg === flag ? [args[i + 1]] : []));
const [suite] = values("--path");
const [agent] = values("--agent");
const [job] = values("--job-name");
const [jobs] = values("--jobs-dir");
const models = values("--model");
const tasks = readdirSync(suite).filter((task) => existsSync(join(suite, task, "task.toml")));
mkdirSync(join(jobs, job), { recursive: true });
writeFileSync(join(jobs, job, "result.json"), JSON.stringify({ id: job }));
for (const task of tasks)
  for (const model of models.length ? models : [undefined]) {
    const name = model ?? agent;
    const scripted = (script.trials ?? []).find((t) => t.model === name && t.task === task) ?? { reward: 1, costUsd: 1 };
    const trial = task + "__" + name.replaceAll("/", "-");
    mkdirSync(join(jobs, job, trial), { recursive: true });
    const result = {
      task_name: task,
      trial_name: trial,
      agent_info: { name: agent, version: "1.0.0", model_info: model ? { name: model, provider: null } : null },
      agent_result: { cost_usd: scripted.costUsd ?? null },
      verifier_result: { rewards: { reward: scripted.reward } },
      exception_info: null,
    };
    writeFileSync(join(jobs, job, trial, "result.json"), JSON.stringify(result));
  }
`;

interface Sut {
  files: { put(path: string, content: string): Promise<void>; read(path: string): Promise<string> };
  cli(args: string[], options?: { env?: Record<string, string> }): Promise<CliResult>;
}

/** Puts the suite with the tasks into $INPUT/suite and the scripted Harbor into $INPUT. */
export async function putSuiteAndHarbor(sut: Sut, tasks: string[], script: HarborScript = {}): Promise<void> {
  for (const task of tasks) await sut.files.put(`$INPUT/suite/${task}/task.toml`, 'schema_version = "1.4"\n');
  await sut.files.put("$INPUT/harbor.mjs", STAND_IN);
  await sut.files.put("$INPUT/harbor-script.json", JSON.stringify(script));
}

/** Runs "taskcapture <args>" with TASKCAPTURE_HARBOR set to the scripted Harbor. */
export const runWithHarbor = (sut: Sut, args: string[]) =>
  sut.cli(args, { env: { TASKCAPTURE_HARBOR: `${process.execPath} harbor.mjs` } });

/** The arguments of every `harbor` call, in order. */
export async function harborCalls(sut: Sut): Promise<string[][]> {
  return (await sut.files.read("$INPUT/harbor-calls.jsonl"))
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

/** The value after `flag` in one call, or undefined. */
export const flag = (call: string[], name: string): string | undefined => {
  const index = call.indexOf(name);
  return index < 0 ? undefined : call[index + 1];
};

/** Every value after `flag` in one call. */
export const flags = (call: string[], name: string): string[] =>
  call.flatMap((arg, index) => (arg === name ? [call[index + 1] as string] : []));

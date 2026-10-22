// taskcapture run: one Harbor job per configuration, then the report over those jobs (ADR 0045).
import { join } from "node:path";
import { check } from "@opensoftware/cli";
import { taskFolders } from "../adapters/files.ts";
import { runHarbor } from "../adapters/harbor.ts";
import { type Configuration, harborArgs, type Matrix } from "../domain/run.ts";
import { report } from "./report.ts";

export interface RunOptions extends Matrix {
  configurations: Configuration[];
  harbor: string;
  report: { out: string; markdown: string | undefined; chart: string | undefined };
}

export async function run(options: RunOptions): Promise<string[]> {
  check(taskFolders(options.suite).length, `${options.suite} holds no Harbor task (a folder with task.toml)`);
  const lines: string[] = [];
  for (const configuration of options.configurations) {
    const code = await runHarbor(options.harbor, harborArgs(options, configuration));
    if (code !== 0) throw new Error(`harbor run for the configuration ${configuration.name} exited with code ${code}`);
    lines.push(`ran the configuration ${configuration.name} with harbor`);
  }
  const jobs = options.configurations.map((configuration) => join(options.jobs, configuration.name));
  return [...lines, ...report(jobs, options.report)];
}

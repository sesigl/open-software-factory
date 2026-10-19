// Child processes with a fixed, minimal environment.
import { spawn, spawnSync } from "node:child_process";

export interface CliResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

/** The clock and seed every module under test gets. */
export const FIXED_DATE = "2026-01-01T00:00:00Z";
export const FIXED_SEED = "1";

export function baseEnv(workspace: string): Record<string, string> {
  return {
    PATH: process.env.PATH ?? "",
    HOME: workspace,
    LANG: "C.UTF-8",
    TZ: "UTC",
    NO_COLOR: "1",
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_AUTHOR_NAME: "Test",
    GIT_AUTHOR_EMAIL: "test@example.invalid",
    GIT_COMMITTER_NAME: "Test",
    GIT_COMMITTER_EMAIL: "test@example.invalid",
    GIT_AUTHOR_DATE: FIXED_DATE,
    GIT_COMMITTER_DATE: FIXED_DATE,
  };
}

export function initGit(workspace: string): void {
  // Synchronous on purpose: the folder must be a repository before the first step runs.
  const result = spawnSync("git", ["init", "-q", "-b", "main"], { cwd: workspace, env: baseEnv(workspace) });
  if (result.status !== 0) throw new Error(`git init failed in the working folder: ${result.stderr}`);
}

export function run(command: string, args: string[], cwd: string, env: Record<string, string>): Promise<CliResult> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { cwd, env });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("error", reject);
    child.on("close", (code) => resolvePromise({ exitCode: code ?? 1, stdout, stderr }));
  });
}

export async function mustRun(command: string, args: string[], cwd: string): Promise<CliResult> {
  const result = await run(command, args, cwd, baseEnv(cwd));
  if (result.exitCode !== 0) throw new Error(`${command} ${args.join(" ")} failed: ${result.stderr}`);
  return result;
}
